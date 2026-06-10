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
exports.listOrganizerEventFeedbackForAdmin = listOrganizerEventFeedbackForAdmin;
exports.updateOrganizerEventFeedbackById = updateOrganizerEventFeedbackById;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
const crypto_1 = require("crypto");
const email_service_1 = require("../../../services/email.service");
const organizer_location_resolve_1 = require("../../../utils/organizer-location-resolve");
const ROLE = "ORGANIZER";
/** Lighter projection for paginated admin list (table + inline view dialog). */
const ORGANIZER_LIST_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    company: true,
    avatar: true,
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
    specialties: true,
    certifications: true,
    businessPhone: true,
    businessAddress: true,
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
};
const ORGANIZER_ADMIN_SELECT = {
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
    profileCountry: true,
    profileState: true,
    profileCity: true,
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
};
function mapOrganizerForAdmin(u) {
    const loc = (0, organizer_location_resolve_1.resolveOrganizerLocationFields)(u);
    return {
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
        organizerCountry: loc.organizerCountry || null,
        organizerState: loc.organizerState || null,
        organizerCity: loc.organizerCity || null,
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
        totalEvents: u._count?.organizedEvents ?? u.totalEvents,
        activeEvents: u.activeEvents,
        totalAttendees: u.totalAttendees,
        totalRevenue: u.totalRevenue,
        averageRating: u.averageRating ?? 0,
        totalReviews: u.totalReviews ?? 0,
        _count: u._count,
    };
}
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
            select: ORGANIZER_LIST_SELECT,
        }),
        prisma_1.default.user.count({ where }),
    ]);
    const data = items.map((u) => mapOrganizerForAdmin(u));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getOrganizerById(id) {
    const user = await prisma_1.default.user.findFirst({
        where: { id, role: ROLE },
        select: ORGANIZER_ADMIN_SELECT,
    });
    if (!user)
        return null;
    const mapped = mapOrganizerForAdmin(user);
    return {
        ...mapped,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    };
}
async function createOrganizer(body) {
    (0, organizer_location_resolve_1.applyOrganizerLocationBodyAliases)(body);
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
    (0, organizer_location_resolve_1.applyOrganizerLocationBodyAliases)(body);
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
async function getOrganizerConnectionsStatsForAdmin() {
    const [totalOrganizers, followerGroups] = await Promise.all([
        prisma_1.default.user.count({ where: { role: ROLE } }),
        prisma_1.default.follow.groupBy({
            by: ["followingId"],
            _count: { _all: true },
        }),
    ]);
    const totalFollowers = followerGroups.reduce((sum, row) => sum + (row._count._all ?? 0), 0);
    const avgFollowersPerOrganizer = totalOrganizers > 0 ? Math.round(totalFollowers / totalOrganizers) : 0;
    let topOrganizer = null;
    if (followerGroups.length > 0) {
        const topRow = followerGroups.reduce((max, row) => (row._count._all ?? 0) > (max._count._all ?? 0) ? row : max);
        const topUser = await prisma_1.default.user.findFirst({
            where: { id: topRow.followingId, role: ROLE },
            select: { firstName: true, lastName: true },
        });
        if (topUser) {
            topOrganizer = {
                firstName: topUser.firstName,
                lastName: topUser.lastName,
                totalFollowers: topRow._count._all ?? 0,
            };
        }
    }
    return { totalOrganizers, totalFollowers, avgFollowersPerOrganizer, topOrganizer };
}
async function listOrganizerConnectionsForAdmin(query = {}) {
    const { page, limit, search, skip } = (0, admin_response_1.parseListQuery)(query);
    const where = { role: ROLE };
    if (search) {
        where.AND = [
            {
                OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                    { organizationName: { contains: search, mode: "insensitive" } },
                ],
            },
        ];
    }
    const [organizers, total, stats] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                organizationName: true,
                createdAt: true,
                totalEvents: true,
                activeEvents: true,
            },
        }),
        prisma_1.default.user.count({ where }),
        getOrganizerConnectionsStatsForAdmin(),
    ]);
    const organizerIds = organizers.map((org) => org.id);
    const followerCounts = new Map();
    if (organizerIds.length > 0) {
        const grouped = await prisma_1.default.follow.groupBy({
            by: ["followingId"],
            where: { followingId: { in: organizerIds } },
            _count: { _all: true },
        });
        for (const row of grouped) {
            followerCounts.set(row.followingId, row._count._all ?? 0);
        }
    }
    const data = organizers.map((org) => ({
        id: org.id,
        firstName: org.firstName,
        lastName: org.lastName,
        email: org.email ?? "",
        avatar: org.avatar,
        organizationName: org.organizationName ?? null,
        totalFollowers: followerCounts.get(org.id) ?? 0,
        totalEvents: org.totalEvents,
        activeEvents: org.activeEvents,
        createdAt: org.createdAt.toISOString(),
    }));
    return {
        data,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        stats,
    };
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
            totalEvents: true,
            activeEvents: true,
        },
    });
    if (!organizer)
        return null;
    const [followersCount, followersRaw] = await Promise.all([
        prisma_1.default.follow.count({ where: { followingId: organizer.id } }),
        prisma_1.default.follow.findMany({
            where: { followingId: organizer.id },
            take: 50,
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
        }),
    ]);
    const followers = followersRaw
        .filter((f) => !!f.follower)
        .map((f) => ({
        id: f.follower.id,
        firstName: f.follower.firstName,
        lastName: f.follower.lastName,
        email: f.follower.email ?? "",
        avatar: f.follower.avatar,
        role: String(f.follower.role),
        followedAt: f.createdAt.toISOString(),
    }));
    const organizerSummary = {
        id: organizer.id,
        firstName: organizer.firstName,
        lastName: organizer.lastName,
        email: organizer.email ?? "",
        avatar: organizer.avatar,
        organizationName: organizer.organizationName ?? null,
        totalFollowers: followersCount,
        totalEvents: organizer.totalEvents,
        activeEvents: organizer.activeEvents,
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
function feedbackDisplayName(first, last, fallback) {
    return `${first ?? ""} ${last ?? ""}`.trim() || fallback;
}
async function listOrganizerEventFeedbackForAdmin() {
    const reviews = await prisma_1.default.review.findMany({
        where: {
            exhibitorId: null,
            venueId: null,
            OR: [{ eventId: { not: null } }, { organizerId: { not: null } }],
        },
        orderBy: { createdAt: "desc" },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                    organizer: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                },
            },
        },
    });
    const organizerIds = [
        ...new Set(reviews.map((r) => r.organizerId).filter(Boolean)),
    ];
    const organizers = organizerIds.length > 0
        ? await prisma_1.default.user.findMany({
            where: { id: { in: organizerIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
        })
        : [];
    const organizerMap = new Map(organizers.map((o) => [o.id, o]));
    return reviews.map((r) => {
        const fromEvent = r.event?.organizer;
        const fromOrganizerId = r.organizerId ? organizerMap.get(r.organizerId) : null;
        const organizerUser = fromEvent ?? fromOrganizerId;
        return {
            id: r.id,
            organizer: organizerUser
                ? {
                    id: organizerUser.id,
                    name: feedbackDisplayName(organizerUser.firstName, organizerUser.lastName, "Organizer"),
                    email: organizerUser.email ?? "",
                }
                : { id: "", name: "—", email: "" },
            event: r.event
                ? { id: r.event.id, title: r.event.title }
                : { id: null, title: null },
            reviewer: r.user
                ? {
                    id: r.user.id,
                    name: feedbackDisplayName(r.user.firstName, r.user.lastName, "Visitor"),
                    email: r.user.email ?? "",
                }
                : { id: "", name: "Anonymous", email: "" },
            rating: r.rating ?? 0,
            title: r.title ?? null,
            comment: r.comment ?? null,
            isApproved: r.isApproved,
            isPublic: r.isPublic,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        };
    });
}
async function updateOrganizerEventFeedbackById(id, body) {
    const review = await prisma_1.default.review.findUnique({ where: { id } });
    if (!review)
        return null;
    if (review.exhibitorId || review.venueId)
        return null;
    const reject = body.action === "reject" || body.action === "rejected";
    const approve = body.action === "approve" || body.action === "approved" || body.isApproved === true;
    await prisma_1.default.review.update({
        where: { id },
        data: {
            isApproved: reject ? false : approve ? true : review.isApproved,
            ...(reject && { isPublic: false }),
            ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
        },
    });
    return { success: true, id };
}
