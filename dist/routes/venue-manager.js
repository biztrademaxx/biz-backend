"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const iana_timezones_1 = require("../utils/iana-timezones");
const router = (0, express_1.Router)();
async function syncLocationMasterFromVenue(input) {
    const countryName = String(input.country ?? "").trim();
    const stateName = String(input.state ?? "").trim();
    const cityName = String(input.city ?? "").trim();
    if (!countryName)
        return;
    const normalizedCode = countryName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "UNK";
    const country = await prisma_1.default.country.upsert({
        where: { name: countryName },
        update: {},
        create: {
            name: countryName,
            code: normalizedCode,
            timezone: "UTC",
            currency: "USD",
            isActive: true,
            isPermitted: false,
        },
    });
    if (stateName) {
        await prisma_1.default.state.upsert({
            where: { name_countryId: { name: stateName, countryId: country.id } },
            update: {},
            create: {
                name: stateName,
                countryId: country.id,
                isActive: true,
                isPermitted: false,
            },
        });
    }
    if (!cityName || !stateName)
        return;
    const existingCity = await prisma_1.default.city.findFirst({
        where: {
            countryId: country.id,
            name: { equals: cityName, mode: "insensitive" },
        },
    });
    if (!existingCity) {
        await prisma_1.default.city.create({
            data: {
                name: cityName,
                state: stateName,
                countryId: country.id,
                timezone: country.timezone || "UTC",
                isActive: true,
                isPermitted: false,
            },
        });
    }
}
// GET /api/venue-manager/:id – venue manager profile + basic stats
router.get("/venue-manager/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid venue manager ID" });
        }
        const venueManager = await prisma_1.default.user.findUnique({
            where: { id },
        });
        if (!venueManager) {
            return res.status(404).json({
                success: false,
                error: "Venue manager not found",
            });
        }
        const now = new Date();
        const [totalEvents, activeBookings] = await Promise.all([
            prisma_1.default.event.count({
                where: { venueId: venueManager.id },
            }),
            prisma_1.default.event.count({
                where: {
                    venueId: venueManager.id,
                    endDate: { gte: now },
                },
            }),
        ]);
        const data = {
            id: venueManager.id,
            name: venueManager.venueName || venueManager.company || "Unnamed Venue",
            description: venueManager.venueDescription ||
                venueManager.bio ||
                "No description available",
            manager: {
                id: venueManager.id,
                name: `${venueManager.firstName ?? ""} ${venueManager.lastName ?? ""}`.trim() || "Venue Manager",
                email: venueManager.email,
                phone: venueManager.phone ?? "",
                avatar: venueManager.avatar ?? "/placeholder.svg",
                isVerified: venueManager.isVerified ?? false,
                bio: venueManager.bio ?? "",
                website: venueManager.website ?? "",
                address: venueManager.venueAddress ?? "",
                description: venueManager.venueDescription ?? "",
                venueName: venueManager.venueName || "Unnamed Venue",
            },
            location: {
                address: venueManager.venueAddress ?? "",
                city: venueManager.venueCity ?? "",
                state: venueManager.venueState ?? "",
                country: venueManager.venueCountry ?? "",
                zipCode: venueManager.venueZipCode ?? "",
                timezone: venueManager.venueTimezone ?? "",
                coordinates: {
                    lat: venueManager.latitude ?? 0,
                    lng: venueManager.longitude ?? 0,
                },
            },
            contact: {
                phone: venueManager.venuePhone || venueManager.phone || "",
                email: venueManager.venueEmail || venueManager.email,
                website: venueManager.venueWebsite || venueManager.website || "",
            },
            capacity: {
                total: venueManager.maxCapacity ?? 0,
                halls: venueManager.totalHalls ?? 0,
            },
            pricing: {
                basePrice: venueManager.basePrice ?? 0,
                currency: venueManager.venueCurrency || "₹",
            },
            stats: {
                averageRating: venueManager.averageRating ?? 0,
                totalReviews: venueManager.totalReviews ?? 0,
                activeBookings,
                totalEvents,
            },
            amenities: venueManager.amenities ?? [],
            images: venueManager.venueImages ?? [],
            videos: venueManager.venueVideos ?? [],
            floorPlans: venueManager.floorPlans ?? [],
            virtualTour: venueManager.virtualTour ?? "",
            meetingSpaces: venueManager.meetingSpaces ?? [],
            reviews: [], // Venue reviews not yet modeled in backend schema
            createdAt: venueManager.createdAt.toISOString(),
            updatedAt: venueManager.updatedAt.toISOString(),
        };
        return res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error in venue-manager GET (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Internal venue error",
            details: error.message,
        });
    }
});
// POST /api/venue-manager/:organizerId – create a new venue manager for an organizer
router.post("/venue-manager/:organizerId", async (req, res) => {
    try {
        const { organizerId } = req.params;
        const body = req.body ?? {};
        const { venueName, logo, contactPerson, firstName, lastName, email, mobile, tempPassword, venueAddress, venueCity, venueState, venueZipCode, venueCountry, website, venueDescription, maxCapacity, totalHalls, activeBookings, averageRating, totalReviews, amenities, meetingSpaces, venueTimezone, } = body;
        if (!organizerId) {
            return res
                .status(400)
                .json({ success: false, error: "Organizer ID is required" });
        }
        if (!venueName) {
            return res
                .status(400)
                .json({ success: false, error: "Venue name is required" });
        }
        const organizer = await prisma_1.default.user.findFirst({
            where: {
                id: organizerId,
                role: "ORGANIZER",
            },
        });
        if (!organizer) {
            return res
                .status(404)
                .json({ success: false, error: "Organizer not found" });
        }
        let managerFirst = firstName ?? "";
        let managerLast = lastName ?? "";
        if (!managerFirst && !managerLast && contactPerson) {
            const parts = String(contactPerson).split(" ");
            managerFirst = parts[0] || "";
            managerLast = parts.slice(1).join(" ") || "";
        }
        const passwordToUse = tempPassword && String(tempPassword).trim()
            ? String(tempPassword).trim()
            : "TEMP_PASSWORD";
        if (!email) {
            return res.status(400).json({
                success: false,
                error: "Venue manager email is required",
            });
        }
        const existingVenue = await prisma_1.default.user.findFirst({
            where: {
                role: "VENUE_MANAGER",
                email,
            },
        });
        if (existingVenue) {
            return res.status(409).json({
                success: false,
                error: "A venue manager with this email already exists",
            });
        }
        const tzCreate = (0, iana_timezones_1.normalizeVenueTimezoneInput)(venueTimezone);
        const venueManager = await prisma_1.default.user.create({
            data: {
                role: "VENUE_MANAGER",
                email,
                firstName: managerFirst || venueName || "Venue",
                lastName: managerLast || "Manager",
                password: passwordToUse,
                venueName,
                company: venueName || null,
                avatar: logo || null,
                phone: mobile || null,
                venueAddress: venueAddress || null,
                venueCity: venueCity || null,
                venueCountry: venueCountry || null,
                venueState: venueState || null,
                venueZipCode: venueZipCode || null,
                website: website || null,
                venueDescription: venueDescription || null,
                bio: venueDescription || null,
                maxCapacity: maxCapacity ? parseInt(String(maxCapacity), 10) : 0,
                totalHalls: totalHalls ? parseInt(String(totalHalls), 10) : 0,
                activeBookings: activeBookings
                    ? parseInt(String(activeBookings), 10)
                    : 0,
                averageRating: averageRating
                    ? parseFloat(String(averageRating))
                    : 0,
                totalReviews: totalReviews ? parseInt(String(totalReviews), 10) : 0,
                amenities: amenities || [],
                organizerIdForVenueManager: organizerId,
                ...(tzCreate !== undefined ? { venueTimezone: tzCreate } : {}),
            },
        });
        await syncLocationMasterFromVenue({
            country: venueCountry,
            state: venueState,
            city: venueCity,
        });
        // Meeting spaces are not yet modeled in backend schema; echo back the
        // provided data so frontend UI can still show them transiently.
        const normalizedMeetingSpaces = Array.isArray(meetingSpaces)
            ? meetingSpaces.map((space) => ({
                name: space?.name || "",
                capacity: space?.capacity ?? 0,
                area: space?.area ?? 0,
                hourlyRate: space?.hourlyRate ?? 0,
                isAvailable: space?.isAvailable !== false,
            }))
            : [];
        return res.status(201).json({
            success: true,
            message: "Venue manager created and added to organizer network",
            venueId: venueManager.id,
            data: {
                venueManager,
                meetingSpaces: normalizedMeetingSpaces,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error in venue-manager POST (backend):", error);
        if (error.code === "P2002") {
            return res
                .status(409)
                .json({ success: false, error: "Email already exists" });
        }
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
});
// PUT /api/venue-manager/:id – update existing venue manager profile
router.put("/venue-manager/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body ?? {};
        if (!id) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid venue manager ID" });
        }
        const { venueName, logo, contactPerson, email, mobile, address, city, state, country, zipCode, website, description, maxCapacity, totalHalls, activeBookings, averageRating, totalReviews, amenities, meetingSpaces, venueImages, venueVideos, floorPlans, virtualTour, latitude, longitude, basePrice, currency, timezone, venueTimezone: venueTimezoneBody, } = body;
        let firstName = "";
        let lastName = "";
        if (contactPerson) {
            const parts = String(contactPerson).split(" ");
            firstName = parts[0] || "";
            lastName = parts.slice(1).join(" ") || "";
        }
        const rawVenueTz = timezone !== undefined ? timezone : venueTimezoneBody;
        const tzUpdate = rawVenueTz !== undefined
            ? (0, iana_timezones_1.normalizeVenueTimezoneInput)(rawVenueTz)
            : undefined;
        const updatedVenue = await prisma_1.default.user.update({
            where: { id },
            data: {
                venueName: venueName ?? undefined,
                company: venueName ?? undefined,
                avatar: logo ?? undefined,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                email: email ?? undefined,
                phone: mobile ?? undefined,
                venueAddress: address ?? undefined,
                venueCity: city ?? undefined,
                venueState: state ?? undefined,
                venueCountry: country ?? undefined,
                venueZipCode: zipCode ?? undefined,
                website: website ?? undefined,
                venueDescription: description ?? undefined,
                bio: description ?? undefined,
                maxCapacity: maxCapacity !== undefined
                    ? parseInt(String(maxCapacity), 10)
                    : undefined,
                totalHalls: totalHalls !== undefined
                    ? parseInt(String(totalHalls), 10)
                    : undefined,
                activeBookings: activeBookings !== undefined
                    ? parseInt(String(activeBookings), 10)
                    : undefined,
                averageRating: averageRating !== undefined
                    ? parseFloat(String(averageRating))
                    : undefined,
                totalReviews: totalReviews !== undefined
                    ? parseInt(String(totalReviews), 10)
                    : undefined,
                amenities: amenities ?? undefined,
                venueImages: venueImages ?? undefined,
                venueVideos: venueVideos ?? undefined,
                floorPlans: floorPlans ?? undefined,
                meetingSpaces: Array.isArray(meetingSpaces)
                    ? meetingSpaces.map((s) => ({
                        id: s?.id ?? `sp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        name: s?.name ?? "",
                        capacity: s?.capacity !== undefined ? Number(s.capacity) : 0,
                        area: s?.area !== undefined ? Number(s.area) : 0,
                        hourlyRate: s?.hourlyRate !== undefined ? Number(s.hourlyRate) : 0,
                        features: Array.isArray(s?.features) ? s.features : (typeof s?.features === "string" ? s.features.split(",").map((f) => f.trim()).filter(Boolean) : []),
                    }))
                    : [],
                virtualTour: virtualTour ?? undefined,
                latitude: latitude !== undefined ? parseFloat(String(latitude)) : undefined,
                longitude: longitude !== undefined ? parseFloat(String(longitude)) : undefined,
                basePrice: basePrice !== undefined ? parseFloat(String(basePrice)) : undefined,
                venueCurrency: currency ?? undefined,
                ...(tzUpdate !== undefined ? { venueTimezone: tzUpdate } : {}),
            },
        });
        await syncLocationMasterFromVenue({
            country,
            state,
            city,
        });
        const savedMeetingSpaces = updatedVenue.meetingSpaces ?? [];
        const venue = {
            id: updatedVenue.id,
            venueName: updatedVenue.venueName || updatedVenue.company || "",
            logo: updatedVenue.avatar || "",
            contactPerson: `${updatedVenue.firstName ?? ""} ${updatedVenue.lastName ?? ""}`.trim(),
            email: updatedVenue.email,
            mobile: updatedVenue.phone || "",
            address: updatedVenue.venueAddress || "",
            city: updatedVenue.venueCity || "",
            state: updatedVenue.venueState || "",
            country: updatedVenue.venueCountry || "",
            zipCode: updatedVenue.venueZipCode || "",
            website: updatedVenue.website || "",
            description: updatedVenue.venueDescription || updatedVenue.bio || "",
            maxCapacity: updatedVenue.maxCapacity || 0,
            totalHalls: updatedVenue.totalHalls || 0,
            totalEvents: updatedVenue.totalEvents || 0,
            activeBookings: updatedVenue.activeBookings || 0,
            averageRating: updatedVenue.averageRating || 0,
            totalReviews: updatedVenue.totalReviews || 0,
            amenities: updatedVenue.amenities || [],
            meetingSpaces: savedMeetingSpaces,
            venueImages: updatedVenue.venueImages || [],
            venueVideos: updatedVenue.venueVideos || [],
            floorPlans: updatedVenue.floorPlans || [],
            virtualTour: updatedVenue.virtualTour || "",
            latitude: updatedVenue.latitude || 0,
            longitude: updatedVenue.longitude || 0,
            basePrice: updatedVenue.basePrice || 0,
            currency: updatedVenue.venueCurrency || "₹",
            timezone: updatedVenue.venueTimezone || "",
        };
        return res.json({
            success: true,
            venue,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error in venue-manager PUT (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Internal venue error",
            details: error.message,
        });
    }
});
exports.default = router;
