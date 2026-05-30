"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrganizers = listOrganizers;
exports.getOrganizerById = getOrganizerById;
exports.createOrganizer = createOrganizer;
exports.updateOrganizer = updateOrganizer;
exports.deleteOrganizer = deleteOrganizer;
exports.sendOrganizerAccountEmail = sendOrganizerAccountEmail;
exports.listOrganizerConnectionsForAdmin = listOrganizerConnectionsForAdmin;
exports.getOrganizerConnectionsDetailForAdmin = getOrganizerConnectionsDetailForAdmin;
exports.listVenueBookingsForAdmin = listVenueBookingsForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
const crypto_1 = require("crypto");
const email_service_1 = require("../../../services/email.service");
const ROLE = "ORGANIZER";
async function listOrganizers(query) {
    const { page, limit, search, skip, sort, order } = (0, admin_response_1.parseListQuery)(query);
    const country = String(query.country ?? "").trim();
    const where = { role: ROLE };
    const filters = [];
    if (search) {
        filters.push({
            OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
                { organizationName: { contains: search, mode: "insensitive" } },
            ],
        });
    }
    if (country && country.toLowerCase() !== "all") {
        filters.push({
            OR: [
                { organizerCountry: { equals: country, mode: "insensitive" } },
                { location: { contains: country, mode: "insensitive" } },
                { headquarters: { contains: country, mode: "insensitive" } },
                { businessAddress: { contains: country, mode: "insensitive" } },
            ],
        });
    }
    if (filters.length > 0) {
        where.AND = filters;
    }
    const [items, total] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sort]: order },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                company: true,
                avatar: true,
                role: true,
                isActive: true,
                isVerified: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                organizationName: true,
                description: true,
                headquarters: true,
                location: true,
                organizerCountry: true,
                organizerState: true,
                organizerCity: true,
                website: true,
                founded: true,
                teamSize: true,
                specialties: true,
                achievements: true,
                certifications: true,
                businessEmail: true,
                businessPhone: true,
                businessAddress: true,
                taxId: true,
                totalEvents: true,
                activeEvents: true,
                totalAttendees: true,
                totalRevenue: true,
                averageRating: true,
                totalReviews: true,
                _count: {
                    select: {
                        organizedEvents: true,
                    },
                },
            },
        }),
        prisma_1.default.user.count({ where }),
    ]);
    const data = items.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        company: u.company,
        avatar: u.avatar,
        role: u.role,
        isActive: u.isActive,
        isVerified: u.isVerified,
        lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        organizationName: u.organizationName,
        description: u.description,
        headquarters: u.headquarters,
        location: u.location,
        organizerCountry: u.organizerCountry,
        organizerState: u.organizerState,
        organizerCity: u.organizerCity,
        website: u.website,
        founded: u.founded,
        teamSize: u.teamSize,
        specialties: u.specialties,
        achievements: u.achievements,
        certifications: u.certifications,
        businessEmail: u.businessEmail,
        businessPhone: u.businessPhone,
        businessAddress: u.businessAddress,
        taxId: u.taxId,
        // Prefer live relation count — User.totalEvents is often stale vs Event rows
        totalEvents: u._count.organizedEvents,
        activeEvents: u.activeEvents,
        totalAttendees: u.totalAttendees,
        totalRevenue: u.totalRevenue,
        averageRating: u.averageRating ?? 0,
        totalReviews: u.totalReviews ?? 0,
        _count: u._count,
    }));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getOrganizerById(id) {
    const user = await prisma_1.default.user.findFirst({
        where: { id, role: ROLE },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
            totalEvents: true,
            activeEvents: true,
            description: true,
            website: true,
            headquarters: true,
            location: true,
            organizerCountry: true,
            organizerState: true,
            organizerCity: true,
            organizationName: true,
        },
    });
    if (!user)
        return null;
    return {
        ...user,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}
async function createOrganizer(body) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email)
        throw new Error("Email is required");
    const existing = await prisma_1.default.user.findFirst({ where: { email, role: ROLE } });
    if (existing)
        throw new Error("Organizer with this email already exists");
    const organizerCity = body.organizerCity != null ? String(body.organizerCity).trim() : "";
    const organizerState = body.organizerState != null ? String(body.organizerState).trim() : "";
    const organizerCountry = body.organizerCountry != null ? String(body.organizerCountry).trim() : "";
    const locationLine = [organizerCity, organizerState, organizerCountry].filter(Boolean).join(", ");
    const user = await prisma_1.default.user.create({
        data: {
            email,
            role: ROLE,
            firstName: String(body.firstName ?? "").trim() || "Organizer",
            lastName: String(body.lastName ?? "").trim() || "",
            phone: body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null,
            website: body.website != null && String(body.website).trim() ? String(body.website).trim() : null,
            company: body.company != null ? String(body.company) : null,
            organizationName: body.organizationName != null ? String(body.organizationName) : body.company != null ? String(body.company) : null,
            description: body.description != null ? String(body.description) : null,
            headquarters: body.headquarters != null ? String(body.headquarters) : null,
            organizerCity: organizerCity || null,
            organizerState: organizerState || null,
            organizerCountry: organizerCountry || null,
            location: locationLine || null,
            founded: body.founded != null ? String(body.founded) : null,
            teamSize: body.teamSize != null ? String(body.teamSize) : null,
            specialties: Array.isArray(body.specialties) ? body.specialties.map((s) => String(s)) : [],
            businessEmail: body.businessEmail != null ? String(body.businessEmail) : null,
            businessPhone: body.businessPhone != null ? String(body.businessPhone) : null,
            businessAddress: body.businessAddress != null ? String(body.businessAddress) : null,
            taxId: body.taxId != null ? String(body.taxId) : null,
            isActive: body.isActive !== false,
            isVerified: body.isVerified === true,
        },
    });
    return getOrganizerById(user.id);
}
async function updateOrganizer(id, body) {
    const existing = await prisma_1.default.user.findFirst({ where: { id, role: ROLE } });
    if (!existing)
        return null;
    const allowed = [
        "firstName",
        "lastName",
        "phone",
        "avatar",
        "company",
        "organizationName",
        "description",
        "headquarters",
        "organizerCountry",
        "organizerState",
        "organizerCity",
        "location",
        "founded",
        "teamSize",
        "businessEmail",
        "businessPhone",
        "businessAddress",
        "taxId",
        "isActive",
        "isVerified",
        "website",
    ];
    const data = {};
    for (const k of allowed) {
        if (body[k] !== undefined)
            data[k] = body[k];
    }
    if (body.organizerCountry !== undefined ||
        body.organizerState !== undefined ||
        body.organizerCity !== undefined) {
        const city = body.organizerCity !== undefined
            ? String(body.organizerCity).trim()
            : (existing.organizerCity ?? "");
        const state = body.organizerState !== undefined
            ? String(body.organizerState).trim()
            : (existing.organizerState ?? "");
        const country = body.organizerCountry !== undefined
            ? String(body.organizerCountry).trim()
            : (existing.organizerCountry ?? "");
        const locationLine = [city, state, country].filter(Boolean).join(", ");
        data.location = locationLine || null;
    }
    if (body.specialties !== undefined) {
        data.specialties = Array.isArray(body.specialties) ? body.specialties.map((s) => String(s)) : [];
    }
    if (body.email !== undefined)
        data.email = String(body.email).trim().toLowerCase();
    await prisma_1.default.user.update({ where: { id }, data: data });
    return getOrganizerById(id);
}
async function deleteOrganizer(id) {
    const existing = await prisma_1.default.user.findFirst({ where: { id, role: ROLE } });
    if (!existing)
        return null;
    await prisma_1.default.user.delete({ where: { id } });
    return { deleted: true };
}
async function sendOrganizerAccountEmail(input) {
    const organizerId = String(input.organizerId ?? "").trim();
    const organizerEmail = String(input.organizerEmail ?? "").trim().toLowerCase();
    if (!organizerId && !organizerEmail) {
        throw new Error("organizerId or organizerEmail is required");
    }
    const organizer = await prisma_1.default.user.findFirst({
        where: {
            role: ROLE,
            ...(organizerId ? { id: organizerId } : {}),
            ...(organizerEmail ? { email: organizerEmail } : {}),
        },
        select: { id: true, email: true, firstName: true },
    });
    if (!organizer?.email)
        throw new Error("Organizer not found");
    const resetToken = (0, crypto_1.randomBytes)(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await prisma_1.default.user.update({
        where: { id: organizer.id },
        data: { resetToken, resetTokenExpiry },
    });
    const base = (0, email_service_1.resolveFrontendBase)().replace(/\/$/, "");
    const resetPasswordUrl = `${base}/reset-password?token=${resetToken}&email=${encodeURIComponent(organizer.email)}`;
    await (0, email_service_1.sendUserAccountAccessEmail)({
        toEmail: organizer.email,
        firstName: organizer.firstName || "there",
        roleLabel: "Organizer",
        resetPasswordUrl,
    });
}
async function listOrganizerConnectionsForAdmin() {
    const organizers = await prisma_1.default.user.findMany({
        where: { role: ROLE },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            organizationName: true,
            createdAt: true,
        },
    });
    const followModel = prisma_1.default.follow;
    const withStats = [];
    const now = new Date();
    for (const org of organizers) {
        let followersCount = 0;
        if (followModel) {
            followersCount = await followModel.count({
                where: { followingId: org.id },
            });
        }
        const [totalEvents, activeEvents] = await Promise.all([
            prisma_1.default.event.count({ where: { organizerId: org.id } }),
            prisma_1.default.event.count({
                where: {
                    organizerId: org.id,
                    status: "PUBLISHED",
                    endDate: { gte: now },
                },
            }),
        ]);
        withStats.push({
            id: org.id,
            firstName: org.firstName,
            lastName: org.lastName,
            email: org.email ?? "",
            avatar: org.avatar,
            organizationName: org.organizationName ?? null,
            totalFollowers: followersCount,
            totalEvents,
            activeEvents,
            createdAt: org.createdAt.toISOString(),
        });
    }
    return withStats;
}
async function getOrganizerConnectionsDetailForAdmin(organizerId) {
    const organizer = await prisma_1.default.user.findFirst({
        where: { id: organizerId, role: ROLE },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            organizationName: true,
            createdAt: true,
        },
    });
    if (!organizer)
        return null;
    const [totalEvents, activeEvents] = await Promise.all([
        prisma_1.default.event.count({ where: { organizerId: organizer.id } }),
        prisma_1.default.event.count({
            where: {
                organizerId: organizer.id,
                status: "PUBLISHED",
                endDate: { gte: new Date() },
            },
        }),
    ]);
    const followModel = prisma_1.default.follow;
    const followersRaw = followModel
        ? await followModel.findMany({
            where: { followingId: organizer.id },
            include: {
                follower: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })
        : [];
    const followers = followersRaw
        .filter((f) => !!f.follower)
        .map((f) => ({
        id: f.follower.id,
        firstName: f.follower.firstName,
        lastName: f.follower.lastName,
        email: f.follower.email ?? "",
        avatar: f.follower.avatar,
        role: String(f.follower.role),
        followedAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
    }));
    const followersCount = followers.length;
    const organizerSummary = {
        id: organizer.id,
        firstName: organizer.firstName,
        lastName: organizer.lastName,
        email: organizer.email ?? "",
        avatar: organizer.avatar,
        organizationName: organizer.organizationName ?? null,
        totalFollowers: followersCount,
        totalEvents,
        activeEvents,
        createdAt: organizer.createdAt.toISOString(),
    };
    return { organizer: organizerSummary, followers };
}
async function listVenueBookingsForAdmin() {
    const appointments = await prisma_1.default.venueAppointment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            venue: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    venueName: true,
                    venueAddress: true,
                    venueCity: true,
                },
            },
            visitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
        },
    });
    return appointments.map((a) => {
        const start = new Date(a.requestedDate);
        const end = new Date(start.getTime() + (a.duration ?? 30) * 60 * 1000);
        return {
            id: a.id,
            venue: {
                id: a.venue.id,
                firstName: a.venue.firstName,
                lastName: a.venue.lastName,
                venueName: a.venue.venueName ?? null,
                venueAddress: a.venue.venueAddress ?? null,
                venueCity: a.venue.venueCity ?? null,
            },
            visitor: a.visitor
                ? {
                    id: a.visitor.id,
                    firstName: a.visitor.firstName,
                    lastName: a.visitor.lastName,
                    email: a.visitor.email ?? null,
                }
                : undefined,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            totalAmount: 0,
            currency: "USD",
            status: a.status,
            purpose: a.purpose ?? null,
            specialRequests: a.notes ?? "",
            meetingSpacesInterested: [],
            requestedTime: a.requestedTime,
            duration: a.duration ?? 30,
            createdAt: a.createdAt.toISOString(),
        };
    });
}
