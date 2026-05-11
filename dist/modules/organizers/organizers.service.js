"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrganizers = listOrganizers;
exports.getOrganizerById = getOrganizerById;
exports.updateOrganizerProfile = updateOrganizerProfile;
exports.getOrganizerAnalytics = getOrganizerAnalytics;
exports.listOrganizerConnections = listOrganizerConnections;
exports.listOrganizerEvents = listOrganizerEvents;
exports.getOrganizerTotalAttendees = getOrganizerTotalAttendees;
exports.listOrganizerLeads = listOrganizerLeads;
exports.listOrganizerLeadsByType = listOrganizerLeadsByType;
exports.listOrganizerPromotions = listOrganizerPromotions;
exports.createOrganizerPromotion = createOrganizerPromotion;
exports.getOrganizerSubscriptionSummary = getOrganizerSubscriptionSummary;
exports.updateOrganizerSubscriptionSummary = updateOrganizerSubscriptionSummary;
exports.listOrganizerReviews = listOrganizerReviews;
exports.createOrganizerReview = createOrganizerReview;
exports.listOrganizerMessages = listOrganizerMessages;
exports.createOrganizerMessage = createOrganizerMessage;
exports.deleteOrganizerMessage = deleteOrganizerMessage;
const prisma_1 = __importDefault(require("../../config/prisma"));
const public_profile_1 = require("../../utils/public-profile");
const profile_image_1 = require("../../utils/profile-image");
const display_name_1 = require("../../utils/display-name");
const profile_slug_1 = require("../../utils/profile-slug");
// ---------- List organizers ----------
async function listOrganizers(options) {
    const requireProfileImage = options?.requireProfileImage ?? false;
    const organizers = await prisma_1.default.user.findMany({
        where: { role: "ORGANIZER", ...(0, public_profile_1.activePublicProfileUserWhere)() },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            bio: true,
            website: true,
            location: true,
            organizationName: true,
            company: true,
            description: true,
            headquarters: true,
            totalReviews: true,
            averageRating: true,
            founded: true,
            teamSize: true,
            specialties: true,
            isVerified: true,
            isActive: true,
            profileVisibility: true,
            createdAt: true,
            updatedAt: true,
            organizedEvents: {
                where: { status: "PUBLISHED" },
                select: { id: true },
            },
        },
    });
    const rows = requireProfileImage
        ? organizers.filter((o) => (0, profile_image_1.hasPublicProfileImage)(o.avatar))
        : organizers;
    /** One grouped query instead of 2×N concurrent queries (avoids exhausting the DB pool on small VPS). */
    const allEventIds = [...new Set(rows.flatMap((o) => o.organizedEvents.map((e) => e.id)))];
    const statsByEventId = new Map();
    if (allEventIds.length > 0) {
        const grouped = await prisma_1.default.eventRegistration.groupBy({
            by: ["eventId"],
            where: {
                eventId: { in: allEventIds },
                status: "CONFIRMED",
            },
            _count: { _all: true },
            _sum: { totalAmount: true },
        });
        for (const g of grouped) {
            statsByEventId.set(g.eventId, {
                registrations: g._count._all,
                revenue: g._sum.totalAmount ?? 0,
            });
        }
    }
    const organizersWithStats = rows.map((organizer) => {
        const eventIds = organizer.organizedEvents.map((e) => e.id);
        let attendeeCount = 0;
        let totalRevenue = 0;
        for (const id of eventIds) {
            const s = statsByEventId.get(id);
            if (s) {
                attendeeCount += s.registrations;
                totalRevenue += s.revenue;
            }
        }
        const foundedYear = organizer.founded ? parseInt(organizer.founded) : new Date().getFullYear();
        const yearsOfExperience = Number.isNaN(foundedYear) ? 0 : new Date().getFullYear() - foundedYear;
        const displayName = (0, display_name_1.getDisplayName)({
            role: "ORGANIZER",
            firstName: organizer.firstName,
            lastName: organizer.lastName,
            organizationName: organizer.organizationName,
        });
        return {
            id: organizer.id,
            name: displayName,
            displayName,
            publicSlug: (0, profile_slug_1.getPublicProfileSlug)({
                role: "ORGANIZER",
                firstName: organizer.firstName,
                lastName: organizer.lastName,
                organizationName: organizer.organizationName,
                company: organizer.company,
            }, "ORGANIZER"),
            company: organizer.organizationName || "",
            image: requireProfileImage
                ? organizer.avatar ?? ""
                : organizer.avatar || "/city/c4.jpg",
            avgRating: organizer.averageRating || 0,
            totalReviews: organizer.totalReviews || 0,
            headquarters: organizer.headquarters || organizer.location || "Not specified",
            reviewCount: organizer.totalReviews || 0,
            location: organizer.location || "Not specified",
            country: "India",
            category: organizer.specialties?.[0] || "General Events",
            eventsOrganized: organizer.organizedEvents.length,
            yearsOfExperience,
            specialties: organizer.specialties || ["Event Management"],
            description: organizer.description || organizer.bio || "No description provided",
            phone: organizer.phone || "Not provided",
            email: organizer.email,
            website: organizer.website || "",
            verified: organizer.isVerified || false,
            active: organizer.isActive || false,
            featured: false,
            totalAttendees: attendeeCount,
            totalRevenue,
            successRate: organizer.organizedEvents.length > 0 ? 95 : 0,
            joinDate: organizer.createdAt.toISOString().split("T")[0],
            lastActive: organizer.updatedAt.toISOString().split("T")[0],
        };
    });
    return organizersWithStats;
}
// ---------- Single organizer ----------
async function resolveOrganizerId(identifier) {
    if ((0, profile_slug_1.isUuidLike)(identifier))
        return identifier;
    const targetSlug = String(identifier || "").trim().toLowerCase();
    if (!targetSlug)
        return null;
    const organizers = await prisma_1.default.user.findMany({
        where: { role: "ORGANIZER", isActive: true },
        select: { id: true, firstName: true, lastName: true, organizationName: true, company: true },
    });
    const withSlug = organizers.map((u) => ({
        u,
        slug: (0, profile_slug_1.getPublicProfileSlug)({
            role: "ORGANIZER",
            firstName: u.firstName,
            lastName: u.lastName,
            organizationName: u.organizationName,
            company: u.company,
        }, "ORGANIZER"),
    }));
    const exact = withSlug.filter((x) => x.slug === targetSlug);
    if (exact.length === 1)
        return exact[0].u.id;
    const loose = withSlug.filter((x) => (0, profile_slug_1.publicSlugRequestMatches)(x.slug, targetSlug));
    if (loose.length === 1)
        return loose[0].u.id;
    if (loose.length > 1) {
        const narrowed = loose.filter((x) => x.slug === targetSlug);
        if (narrowed.length === 1)
            return narrowed[0].u.id;
        return null;
    }
    return null;
}
async function getOrganizerById(identifier, viewerUserId) {
    const id = await resolveOrganizerId(identifier);
    if (!id)
        return null;
    const organizer = await prisma_1.default.user.findFirst({
        where: {
            id,
            role: "ORGANIZER",
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            bio: true,
            website: true,
            linkedin: true,
            twitter: true,
            company: true,
            location: true,
            organizationName: true,
            description: true,
            headquarters: true,
            founded: true,
            teamSize: true,
            specialties: true,
            achievements: true,
            certifications: true,
            businessEmail: true,
            businessPhone: true,
            businessAddress: true,
            totalEvents: true,
            activeEvents: true,
            totalAttendees: true,
            totalRevenue: true,
            createdAt: true,
            isActive: true,
            profileVisibility: true,
            _count: {
                select: {
                    organizedEvents: {
                        where: {
                            status: "PUBLISHED",
                        },
                    },
                },
            },
        },
    });
    if (!organizer) {
        return null;
    }
    if (!(0, public_profile_1.canUserViewOwnPrivateProfile)(viewerUserId ?? undefined, id) &&
        (!organizer.isActive || organizer.profileVisibility === "private")) {
        return null;
    }
    const eventStats = await prisma_1.default.event.aggregate({
        where: {
            organizerId: id,
        },
        _count: {
            id: true,
        },
    });
    const activeEventStats = await prisma_1.default.event.aggregate({
        where: {
            organizerId: id,
            status: "PUBLISHED",
        },
        _count: {
            id: true,
        },
    });
    const attendeeStats = await prisma_1.default.eventRegistration.aggregate({
        where: {
            event: {
                organizerId: id,
            },
            status: "CONFIRMED",
        },
        _count: {
            id: true,
        },
        _sum: {
            totalAmount: true,
        },
    });
    const allEventsAttendeesCount = await prisma_1.default.eventLead.count({
        where: {
            event: { organizerId: id },
            type: "attendee",
        },
    });
    const displayName = (0, display_name_1.getDisplayName)({
        role: "ORGANIZER",
        firstName: organizer.firstName,
        lastName: organizer.lastName,
        organizationName: organizer.organizationName,
        company: organizer.company,
    });
    const organizerData = {
        id: organizer.id,
        name: displayName,
        displayName,
        publicSlug: (0, profile_slug_1.getPublicProfileSlug)({
            role: "ORGANIZER",
            firstName: organizer.firstName,
            lastName: organizer.lastName,
            organizationName: organizer.organizationName,
            company: organizer.company,
        }, "ORGANIZER"),
        firstName: organizer.firstName,
        lastName: organizer.lastName,
        company: organizer.organizationName || organizer.company || `${organizer.firstName} ${organizer.lastName}`,
        email: organizer.email,
        phone: organizer.phone || "",
        location: organizer.location || "",
        website: organizer.website || "",
        description: organizer.description || organizer.bio || "",
        avatar: organizer.avatar || "/placeholder.svg?height=100&width=100&text=Avatar",
        totalEvents: eventStats._count.id,
        activeEvents: activeEventStats._count.id,
        totalAttendees: allEventsAttendeesCount,
        totalRevenue: attendeeStats._sum.totalAmount || 0,
        founded: organizer.founded || "2020",
        teamSize: organizer.teamSize || "1-10",
        headquarters: organizer.headquarters || organizer.location || "Not specified",
        specialties: organizer.specialties || ["Event Management"],
        achievements: organizer.achievements || [],
        certifications: organizer.certifications || [],
        organizationName: organizer.organizationName || organizer.company || `${organizer.firstName} ${organizer.lastName}`,
        businessEmail: organizer.businessEmail || organizer.email,
        businessPhone: organizer.businessPhone || organizer.phone,
        businessAddress: organizer.businessAddress || organizer.location,
    };
    return organizerData;
}
// ---------- Update organizer profile (self-service) ----------
async function updateOrganizerProfile(organizerId, body) {
    const existing = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: "ORGANIZER" },
    });
    if (!existing) {
        return null;
    }
    const data = {};
    if (body.company !== undefined || body.organizationName !== undefined) {
        const organizationName = body.organizationName ??
            body.company ??
            existing.organizationName ??
            existing.company ??
            `${existing.firstName} ${existing.lastName}`;
        data.company = body.company ?? organizationName;
        data.organizationName = organizationName;
    }
    if (body.description !== undefined) {
        data.description = body.description ?? null;
    }
    if (body.email !== undefined) {
        data.email = String(body.email ?? "").trim().toLowerCase();
    }
    if (body.phone !== undefined) {
        data.phone = body.phone != null ? String(body.phone) : null;
    }
    if (body.website !== undefined) {
        data.website = body.website != null ? String(body.website) : null;
    }
    if (body.headquarters !== undefined) {
        const hq = body.headquarters != null ? String(body.headquarters) : null;
        data.headquarters = hq;
        if (!body.location) {
            data.location = hq;
        }
    }
    if (body.location !== undefined) {
        data.location = body.location != null ? String(body.location) : null;
    }
    if (body.founded !== undefined) {
        data.founded = body.founded != null ? String(body.founded) : null;
    }
    if (body.teamSize !== undefined) {
        data.teamSize = body.teamSize != null ? String(body.teamSize) : null;
    }
    if (body.specialties !== undefined && Array.isArray(body.specialties)) {
        data.specialties = body.specialties;
    }
    if (body.achievements !== undefined && Array.isArray(body.achievements)) {
        data.achievements = body.achievements;
    }
    if (body.certifications !== undefined && Array.isArray(body.certifications)) {
        data.certifications = body.certifications;
    }
    if (body.businessEmail !== undefined) {
        data.businessEmail = body.businessEmail != null ? String(body.businessEmail) : null;
    }
    if (body.businessPhone !== undefined) {
        data.businessPhone = body.businessPhone != null ? String(body.businessPhone) : null;
    }
    if (body.businessAddress !== undefined) {
        data.businessAddress = body.businessAddress != null ? String(body.businessAddress) : null;
    }
    if (body.avatar !== undefined) {
        data.avatar = body.avatar != null ? String(body.avatar) : null;
    }
    await prisma_1.default.user.update({
        where: { id: organizerId },
        data: data,
    });
    return getOrganizerById(organizerId);
}
// ---------- Organizer analytics ----------
function getColorForCategory(category) {
    const colors = {
        Technology: "#3B82F6",
        Healthcare: "#10B981",
        Business: "#F59E0B",
        Education: "#EF4444",
        Entertainment: "#8B5CF6",
        Sports: "#06B6D4",
        Other: "#6B7280",
    };
    return colors[category] ?? "#6B7280";
}
async function getOrganizerAnalytics(id) {
    const organizer = await prisma_1.default.user.findFirst({
        where: {
            id,
            role: "ORGANIZER",
        },
    });
    if (!organizer) {
        return null;
    }
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const eventAnalytics = await prisma_1.default.eventAnalytics.findMany({
        where: {
            event: {
                organizerId: id,
            },
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        include: {
            event: {
                select: {
                    id: true,
                    title: true,
                    category: true,
                    startDate: true,
                },
            },
        },
        orderBy: {
            date: "asc",
        },
    });
    let analyticsData;
    if (eventAnalytics.length === 0) {
        const events = await prisma_1.default.event.findMany({
            where: { organizerId: id },
            select: {
                id: true,
                title: true,
                category: true,
                startDate: true,
                _count: {
                    select: {
                        registrations: {
                            where: { status: "CONFIRMED" },
                        },
                    },
                },
                registrations: {
                    where: { status: "CONFIRMED" },
                    select: { totalAmount: true },
                },
            },
        });
        const totalRegistrations = events.reduce((sum, event) => sum + event._count.registrations, 0);
        const totalRevenue = events.reduce((sum, event) => sum + event.registrations.reduce((eventSum, reg) => eventSum + (reg.totalAmount ?? 0), 0), 0);
        const registrationData = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayRegistrations = Math.floor(totalRegistrations / 30) + Math.floor(Math.random() * 10);
            registrationData.push({
                month: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                registrations: dayRegistrations,
            });
        }
        const eventTypeData = events.reduce((acc, event) => {
            const raw = event.category;
            const category = (Array.isArray(raw) ? raw[0] : raw) || "Other";
            const existing = acc.find((item) => item.name === category);
            if (existing) {
                existing.value += event._count.registrations;
            }
            else {
                acc.push({
                    name: category,
                    value: event._count.registrations,
                    color: getColorForCategory(category),
                });
            }
            return acc;
        }, []);
        analyticsData = {
            registrationData,
            eventTypeData,
            summary: {
                totalLeads: totalRegistrations * 1.5,
                qualifiedLeads: Math.floor(totalRegistrations * 1.2),
                hotLeads: Math.floor(totalRegistrations * 0.3),
                conversionRate: totalRegistrations > 0 ? 18.7 : 0,
                totalVisitors: totalRegistrations * 8,
                uniqueVisitors: totalRegistrations * 6,
                avgSessionDuration: "4m 32s",
                bounceRate: 24.5,
                totalExhibitors: Math.floor(events.length * 15),
                confirmedExhibitors: Math.floor(events.length * 12),
                totalBoothRevenue: totalRevenue * 0.4,
            },
        };
    }
    else {
        const totalRegistrations = eventAnalytics.reduce((sum, analytics) => sum + analytics.totalRegistrations, 0);
        const totalRevenue = eventAnalytics.reduce((sum, analytics) => sum + analytics.totalRevenue, 0);
        const totalPageViews = eventAnalytics.reduce((sum, analytics) => sum + analytics.pageViews, 0);
        const totalUniqueVisitors = eventAnalytics.reduce((sum, analytics) => sum + analytics.uniqueVisitors, 0);
        const averageConversionRate = eventAnalytics.length > 0
            ? eventAnalytics.reduce((sum, analytics) => sum + analytics.conversionRate, 0) / eventAnalytics.length
            : 0;
        const registrationData = eventAnalytics.map((analytics) => ({
            month: analytics.date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            }),
            registrations: analytics.totalRegistrations,
        }));
        const eventTypeMap = new Map();
        eventAnalytics.forEach((analytics) => {
            const raw = analytics.event.category;
            const category = (Array.isArray(raw) ? raw[0] : raw) || "Other";
            const current = eventTypeMap.get(category) || 0;
            eventTypeMap.set(category, current + analytics.totalRegistrations);
        });
        const eventTypeData = Array.from(eventTypeMap.entries()).map(([name, value]) => ({
            name,
            value,
            color: getColorForCategory(name),
        }));
        analyticsData = {
            registrationData,
            eventTypeData,
            summary: {
                totalLeads: Math.floor(totalRegistrations * 1.5),
                qualifiedLeads: Math.floor(totalRegistrations * 1.2),
                hotLeads: Math.floor(totalRegistrations * 0.3),
                conversionRate: Math.round(averageConversionRate * 100) / 100,
                totalVisitors: totalPageViews,
                uniqueVisitors: totalUniqueVisitors,
                avgSessionDuration: "4m 32s",
                bounceRate: 24.5,
                totalExhibitors: Math.floor(totalRegistrations * 0.1),
                confirmedExhibitors: Math.floor(totalRegistrations * 0.08),
                totalBoothRevenue: totalRevenue * 0.4,
            },
        };
    }
    return analyticsData;
}
// ---------- Organizer connections (messaging sidebar) ----------
async function listOrganizerConnections(organizerId) {
    // For compatibility with the legacy Next.js route, we don't persist
    // a Connection model yet; we expose a curated list of active users
    // (excluding the organizer themself) as "connections".
    const users = await prisma_1.default.user.findMany({
        where: {
            AND: [
                { id: { not: organizerId } },
                { isActive: true },
            ],
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
            company: true,
            jobTitle: true,
            lastLogin: true,
        },
        orderBy: [
            { lastLogin: "desc" },
            { firstName: "asc" },
        ],
        take: 100,
    });
    const connections = users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar || "/placeholder.svg?height=40&width=40",
        role: user.role,
        company: user.company || "No Company",
        jobTitle: user.jobTitle || "No Title",
        lastLogin: user.lastLogin?.toISOString() || new Date().toISOString(),
        isOnline: false,
    }));
    return connections;
}
// ---------- Organizer events list (all statuses) ----------
const eventStatusMap = {
    PUBLISHED: "Approved",
    PENDING_APPROVAL: "Pending Review",
    DRAFT: "Draft",
    CANCELLED: "Flagged",
    REJECTED: "Rejected",
    COMPLETED: "Approved",
};
async function listOrganizerEvents(organizerId, page = 1, limit = 50, viewerUserId) {
    organizerId = (await resolveOrganizerId(organizerId)) ?? "";
    if (!organizerId) {
        return {
            events: [],
            pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        };
    }
    const skip = (page - 1) * limit;
    const org = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: "ORGANIZER" },
        select: { id: true, isActive: true, profileVisibility: true },
    });
    if (!org) {
        throw new Error("Organizer ID is required");
    }
    const isOwner = (0, public_profile_1.canUserViewOwnPrivateProfile)(viewerUserId ?? undefined, organizerId);
    if (!isOwner && (!org.isActive || org.profileVisibility === "private")) {
        return {
            events: [],
            pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        };
    }
    const eventWhere = isOwner
        ? { organizerId }
        : { AND: [{ organizerId }, (0, public_profile_1.publicPublishedEventWhere)()] };
    const [events, total] = await Promise.all([
        prisma_1.default.event.findMany({
            where: eventWhere,
            include: {
                organizer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                    },
                },
                venue: {
                    select: {
                        id: true,
                        venueName: true,
                        venueCity: true,
                        venueState: true,
                        venueCountry: true,
                        venueAddress: true,
                    },
                },
                ticketTypes: {
                    where: { isActive: true },
                    select: { id: true, name: true, price: true, quantity: true },
                    orderBy: { price: "asc" },
                    take: 1,
                },
                _count: {
                    select: {
                        registrations: { where: { status: "CONFIRMED" } },
                        reviews: true,
                    },
                },
                reviews: { select: { rating: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma_1.default.event.count({ where: eventWhere }),
    ]);
    const transformed = events.map((event) => {
        const avgRating = event.reviews.length > 0
            ? event.reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / event.reviews.length
            : 0;
        const cheapestTicket = event.ticketTypes[0]?.price ?? 0;
        return {
            id: event.id,
            title: event.title,
            description: event.description,
            shortDescription: event.shortDescription,
            slug: event.slug,
            startDate: event.startDate.toISOString(),
            endDate: event.endDate.toISOString(),
            timezone: event.timezone,
            location: event.venue?.venueName ?? "Virtual Event",
            city: event.venue?.venueCity ?? "",
            state: event.venue?.venueState ?? "",
            country: event.venue?.venueCountry ?? "",
            address: event.venue?.venueAddress ?? "",
            isVirtual: event.isVirtual,
            virtualLink: event.virtualLink,
            status: eventStatusMap[event.status] ?? "Pending Review",
            category: event.category ?? [],
            tags: event.tags ?? [],
            eventType: event.eventType ?? [],
            isFeatured: event.isFeatured,
            isVIP: event.isVIP,
            isVerified: event.isVerified ?? false,
            verifiedAt: event.verifiedAt?.toISOString() ?? null,
            verifiedBy: event.verifiedBy ?? "",
            attendees: event._count.registrations,
            totalReviews: event._count.reviews,
            averageRating: avgRating,
            cheapestTicket,
            currency: event.currency,
            images: event.images,
            bannerImage: event.bannerImage,
            thumbnailImage: event.thumbnailImage,
            organizer: {
                id: event.organizer.id,
                name: `${event.organizer.firstName} ${event.organizer.lastName}`.trim(),
                email: isOwner ? event.organizer.email : "",
                avatar: event.organizer.avatar,
            },
            createdAt: event.createdAt.toISOString(),
            updatedAt: event.updatedAt.toISOString(),
        };
    });
    return {
        events: transformed,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
        },
    };
}
// ---------- Organizer total attendees ----------
async function getOrganizerTotalAttendees(id) {
    const organizerId = id;
    if (!organizerId) {
        throw new Error("Organizer ID is required");
    }
    const events = await prisma_1.default.event.findMany({
        where: {
            organizerId,
        },
        select: {
            id: true,
            title: true,
        },
    });
    if (events.length === 0) {
        return {
            success: true,
            totalAttendees: 0,
            eventsCount: 0,
            statusCounts: {
                NEW: 0,
                CONTACTED: 0,
                QUALIFIED: 0,
                CONVERTED: 0,
                FOLLOW_UP: 0,
                REJECTED: 0,
            },
            eventWiseCounts: [],
            events: [],
            attendees: [],
        };
    }
    const eventIds = events.map((e) => e.id);
    const attendeeLeads = await prisma_1.default.eventLead.findMany({
        where: {
            eventId: {
                in: eventIds,
            },
            type: "attendee",
        },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                    organizerId: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    const verifiedLeads = attendeeLeads.filter((lead) => lead.event != null && lead.user != null && events.some((e) => e.id === lead.event.id));
    const statusCounts = {
        NEW: verifiedLeads.filter((l) => l.status === "NEW").length,
        CONTACTED: verifiedLeads.filter((l) => l.status === "CONTACTED").length,
        QUALIFIED: verifiedLeads.filter((l) => l.status === "QUALIFIED").length,
        CONVERTED: verifiedLeads.filter((l) => l.status === "CONVERTED").length,
        FOLLOW_UP: verifiedLeads.filter((l) => l.status === "FOLLOW_UP").length,
        REJECTED: verifiedLeads.filter((l) => l.status === "REJECTED").length,
    };
    const eventWiseCounts = events.map((event) => ({
        eventId: event.id,
        eventTitle: event.title,
        count: verifiedLeads.filter((l) => l.event.id === event.id).length,
    }));
    const attendees = verifiedLeads.map((lead) => ({
        id: lead.id,
        userId: lead.user.id,
        firstName: lead.user.firstName,
        lastName: lead.user.lastName,
        email: lead.user.email,
        status: lead.status,
        eventId: lead.event.id,
        eventTitle: lead.event.title,
        registeredAt: lead.createdAt,
    }));
    return {
        success: true,
        totalAttendees: verifiedLeads.length,
        eventsCount: events.length,
        statusCounts,
        eventWiseCounts,
        events,
        attendees,
    };
}
// ---------- Organizer leads ----------
async function listOrganizerLeads(organizerId) {
    const events = await prisma_1.default.event.findMany({
        where: { organizerId },
        select: {
            id: true,
            title: true,
        },
    });
    if (events.length === 0) {
        return {
            leads: [],
            events: [],
        };
    }
    const eventIds = events.map((e) => e.id);
    const leads = await prisma_1.default.eventLead.findMany({
        where: {
            eventId: { in: eventIds },
        },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    avatar: true,
                },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return {
        leads,
        events,
    };
}
async function listOrganizerLeadsByType(organizerId, type) {
    const events = await prisma_1.default.event.findMany({
        where: { organizerId },
        select: {
            id: true,
            title: true,
        },
    });
    if (events.length === 0) {
        return {
            leads: [],
            events: [],
        };
    }
    const eventIds = events.map((e) => e.id);
    const leads = await prisma_1.default.eventLead.findMany({
        where: {
            eventId: { in: eventIds },
            type,
        },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    avatar: true,
                },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return {
        leads,
        events,
    };
}
// ---------- Organizer promotions ----------
async function listOrganizerPromotions(organizerId) {
    const promotions = await prisma_1.default.promotion.findMany({
        where: { organizerId },
        include: {
            event: {
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                    status: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return promotions;
}
async function createOrganizerPromotion(organizerId, body) {
    const eventId = body.eventId ?? null;
    if (!eventId) {
        return { error: "EVENT_REQUIRED" };
    }
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true, organizerId: true },
    });
    if (!event || event.organizerId !== organizerId) {
        return { error: "NOT_FOUND" };
    }
    const startDate = new Date();
    const endDate = new Date();
    const durationDays = Number(body.duration) || 7;
    endDate.setDate(endDate.getDate() + durationDays);
    const promotion = await prisma_1.default.promotion.create({
        data: {
            organizerId,
            eventId,
            packageType: body.packageType ?? "CUSTOM",
            targetCategories: body.targetCategories ?? [],
            amount: Number(body.amount) || 0,
            duration: durationDays,
            startDate,
            endDate,
            status: "ACTIVE",
        },
        include: {
            event: {
                select: { id: true, title: true, startDate: true, status: true },
            },
        },
    });
    return { promotion };
}
// ---------- Organizer subscription (summary only) ----------
async function getOrganizerSubscriptionSummary(organizerId) {
    const organizer = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: "ORGANIZER" },
        select: {
            id: true,
            totalEvents: true,
            totalAttendees: true,
            totalRevenue: true,
            createdAt: true,
        },
    });
    if (!organizer) {
        return null;
    }
    // Simple derived subscription summary based on organizer stats
    const planType = organizer.totalEvents > 20 || organizer.totalRevenue > 100000
        ? "ENTERPRISE"
        : organizer.totalEvents > 5 || organizer.totalRevenue > 20000
            ? "PREMIUM"
            : "BASIC";
    const status = "ACTIVE";
    return {
        organizerId: organizer.id,
        planType,
        status,
        totalEvents: organizer.totalEvents,
        totalAttendees: organizer.totalAttendees,
        totalRevenue: organizer.totalRevenue,
        memberSince: organizer.createdAt.toISOString(),
    };
}
async function updateOrganizerSubscriptionSummary(organizerId, data) {
    const current = await getOrganizerSubscriptionSummary(organizerId);
    if (!current) {
        return null;
    }
    return {
        ...current,
        planType: data.planType ?? current.planType,
        status: data.status ?? current.status,
    };
}
// ---------- Organizer reviews ----------
async function listOrganizerReviews(organizerId, options) {
    organizerId = (await resolveOrganizerId(organizerId)) ?? "";
    if (!organizerId)
        return [];
    const reviews = await prisma_1.default.review.findMany({
        where: { organizerId },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                },
            },
            ...(options?.includeReplies && {
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                avatar: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
            }),
        },
        orderBy: { createdAt: "desc" },
    });
    return reviews.map((r) => ({
        id: r.id,
        rating: r.rating ?? 0,
        title: "",
        comment: r.comment ?? "",
        createdAt: r.createdAt.toISOString(),
        isApproved: true,
        isPublic: true,
        user: r.user
            ? {
                id: r.user.id,
                firstName: r.user.firstName,
                lastName: r.user.lastName,
                avatar: r.user.avatar ?? undefined,
            }
            : { id: "", firstName: "Guest", lastName: "", avatar: undefined },
        event: r.event ?? undefined,
        replies: r.replies?.map((rep) => ({
            id: rep.id,
            content: rep.content,
            createdAt: rep.createdAt.toISOString(),
            isOrganizerReply: rep.isOrganizerReply,
            user: rep.user
                ? {
                    id: rep.user.id,
                    firstName: rep.user.firstName,
                    lastName: rep.user.lastName,
                    avatar: rep.user.avatar ?? undefined,
                }
                : { id: "", firstName: "Guest", lastName: "", avatar: undefined },
        })) ?? [],
    }));
}
async function createOrganizerReview(params) {
    const { organizerId, userId, rating, comment } = params;
    if (!organizerId || !userId) {
        throw new Error("organizerId and userId are required");
    }
    if (!rating || rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
    }
    const organizer = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: "ORGANIZER" },
        select: { id: true },
    });
    if (!organizer) {
        throw new Error("Organizer not found");
    }
    const existing = await prisma_1.default.review.findFirst({
        where: { userId, organizerId },
    });
    if (existing) {
        throw new Error("You have already reviewed this organizer");
    }
    const review = await prisma_1.default.review.create({
        data: {
            userId,
            organizerId,
            rating,
            comment,
        },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                },
            },
        },
    });
    const all = await prisma_1.default.review.findMany({
        where: { organizerId, rating: { not: null } },
    });
    const totalReviews = all.length;
    const avg = totalReviews === 0
        ? 0
        : all.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews;
    await prisma_1.default.user.update({
        where: { id: organizerId },
        data: {
            averageRating: Math.round(avg * 10) / 10,
            totalReviews,
        },
    });
    return {
        id: review.id,
        rating: review.rating ?? 0,
        title: "",
        comment: review.comment ?? "",
        createdAt: review.createdAt.toISOString(),
        user: review.user
            ? {
                id: review.user.id,
                firstName: review.user.firstName,
                lastName: review.user.lastName,
                avatar: review.user.avatar ?? undefined,
            }
            : { id: "", firstName: "Guest", lastName: "", avatar: undefined },
    };
}
// ---------- Organizer messages (placeholder) ----------
async function listOrganizerMessages(organizerId) {
    // For now, just verify the organizer exists and return an empty list.
    const organizer = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: "ORGANIZER" },
        select: { id: true },
    });
    if (!organizer) {
        return null;
    }
    return {
        messages: [],
    };
}
async function createOrganizerMessage(organizerId, _data) {
    const organizer = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: "ORGANIZER" },
        select: { id: true },
    });
    if (!organizer) {
        return { error: "NOT_FOUND" };
    }
    // Placeholder: return a synthetic message payload
    const now = new Date();
    return {
        message: {
            id: `${organizerId}-${now.getTime()}`,
            organizerId,
            subject: _data.subject ?? null,
            content: _data.content,
            contactId: _data.contactId ?? null,
            createdAt: now.toISOString(),
        },
    };
}
async function deleteOrganizerMessage(organizerId, _messageId) {
    const organizer = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: "ORGANIZER" },
        select: { id: true },
    });
    if (!organizer) {
        return { error: "NOT_FOUND" };
    }
    // Placeholder – nothing to delete yet, but we return a success flag
    return { deleted: true };
}
