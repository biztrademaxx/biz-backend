"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdminEvents = listAdminEvents;
exports.updateAdminEvent = updateAdminEvent;
exports.adminListEvents = adminListEvents;
exports.adminGetEventStats = adminGetEventStats;
exports.adminGetEventById = adminGetEventById;
exports.adminUpdateEvent = adminUpdateEvent;
exports.adminVerifyEvent = adminVerifyEvent;
exports.adminDeleteEvent = adminDeleteEvent;
exports.adminApproveEvent = adminApproveEvent;
exports.adminRejectEvent = adminRejectEvent;
exports.adminListVenues = adminListVenues;
exports.adminListVisitors = adminListVisitors;
exports.adminGetDashboardSummary = adminGetDashboardSummary;
exports.adminListEventCategories = adminListEventCategories;
exports.adminGetEventMailCandidates = adminGetEventMailCandidates;
exports.adminSendEventListingEmail = adminSendEventListingEmail;
const prisma_1 = __importDefault(require("../../config/prisma"));
const client_1 = require("@prisma/client");
const event_schedule_1 = require("../events/event-schedule");
const youtube_url_1 = require("../../utils/youtube-url");
const cloudinary_service_1 = require("../../services/cloudinary.service");
const crypto_1 = require("crypto");
const email_service_1 = require("../../services/email.service");
function toStatusLabel(status) {
    switch (String(status)) {
        case "PUBLISHED":
            return "Approved";
        case "PENDING_APPROVAL":
            return "Pending Review";
        case "REJECTED":
            return "Rejected";
        case "CANCELLED":
            return "Flagged";
        case "DRAFT":
        default:
            return "Draft";
    }
}
async function listAdminEvents() {
    const events = await prisma_1.default.event.findMany({
        orderBy: { createdAt: "desc" },
    });
    return events;
}
async function updateAdminEvent(params) {
    const { id, statusLabel, featured, vip, isVerified, adminEmail } = params;
    const data = {};
    if (typeof featured === "boolean") {
        data.isFeatured = featured;
    }
    if (typeof vip === "boolean") {
        data.isVIP = vip;
    }
    if (typeof isVerified === "boolean") {
        data.isVerified = isVerified;
        if (isVerified) {
            data.verifiedAt = new Date();
            data.verifiedBy = adminEmail ?? "Admin";
        }
        else {
            data.verifiedAt = null;
            data.verifiedBy = null;
            data.verifiedBadgeImage = null;
        }
    }
    if (statusLabel) {
        let mapped;
        switch (statusLabel) {
            case "Approved":
                mapped = client_1.EventStatus.PUBLISHED;
                break;
            case "Pending Review":
                mapped = client_1.EventStatus.PENDING_APPROVAL;
                break;
            case "Rejected":
                mapped = client_1.EventStatus.REJECTED;
                break;
            case "Draft":
                mapped = client_1.EventStatus.DRAFT;
                break;
            case "Flagged":
                mapped = client_1.EventStatus.CANCELLED;
                break;
            default:
                mapped = client_1.EventStatus.DRAFT;
                break;
        }
        data.status = mapped;
    }
    const event = await prisma_1.default.event.update({
        where: { id },
        data,
    });
    return event;
}
async function adminListEvents(params) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;
    const where = {};
    if (params.status) {
        where.status = params.status.toUpperCase();
    }
    const search = (params.search || "").trim();
    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { rejectionReason: { contains: search, mode: "insensitive" } },
            {
                organizer: {
                    OR: [
                        { firstName: { contains: search, mode: "insensitive" } },
                        { lastName: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                    ],
                },
            },
        ];
    }
    const [rawEvents, total] = await Promise.all([
        prisma_1.default.event.findMany({
            where,
            include: {
                organizer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        company: true,
                        phone: true,
                    },
                },
                venue: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        venueName: true,
                        venueAddress: true,
                        venueCity: true,
                        venueState: true,
                        venueCountry: true,
                    },
                },
                ticketTypes: {
                    select: { id: true, name: true, price: true, quantity: true },
                },
                exhibitionSpaces: {
                    select: { id: true, name: true, spaceType: true, basePrice: true, area: true },
                },
                _count: { select: { leads: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma_1.default.event.count({ where }),
    ]);
    const events = rawEvents.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        shortDescription: event.shortDescription,
        subTitle: event.subTitle ?? null,
        edition: event.edition ?? null,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        registrationStart: event.registrationStart.toISOString(),
        registrationEnd: event.registrationEnd.toISOString(),
        timezone: event.timezone,
        venue: event.venue?.venueName ||
            (event.venue ? `${event.venue.firstName || ""} ${event.venue.lastName || ""}`.trim() || "Not specified" : "Not specified") ||
            "Not specified",
        city: event.venue?.venueCity ?? "Not specified",
        state: event.venue?.venueState ?? "",
        country: event.venue?.venueCountry ?? "",
        status: toStatusLabel(event.status),
        statusRaw: event.status,
        category: Array.isArray(event.category) ? event.category : [],
        isVirtual: event.isVirtual,
        virtualLink: event.virtualLink,
        maxAttendees: event.maxAttendees,
        currentAttendees: event.currentAttendees,
        currency: event.currency,
        images: event.images ?? [],
        videos: event.videos ?? [],
        documents: event.documents ?? [],
        brochure: event.brochure ?? null,
        layoutPlan: event.layoutPlan ?? null,
        slug: event.slug,
        tags: event.tags ?? [],
        eventType: event.eventType ?? [],
        youtubeVideoUrl: event.youtubeVideoUrl ?? null,
        bannerImage: event.bannerImage,
        vipImage: event.vipImage ?? null,
        thumbnailImage: event.thumbnailImage,
        organizer: event.organizer
            ? {
                id: event.organizer.id,
                name: `${event.organizer.firstName || ""} ${event.organizer.lastName || ""}`.trim(),
                email: event.organizer.email,
                company: event.organizer.company ?? "",
                phone: event.organizer.phone ?? "",
            }
            : null,
        ticketTypes: event.ticketTypes ?? [],
        exhibitionSpaces: event.exhibitionSpaces ?? [],
        leadsCount: event._count?.leads ?? 0,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        rejectionReason: event.rejectionReason ?? undefined,
        rejectedAt: event.rejectedAt?.toISOString(),
        rejectedBy: event.rejectedBy ?? undefined,
        isFeatured: event.isFeatured ?? false,
        isVIP: event.isVIP ?? false,
        featured: event.isFeatured ?? false,
        vip: event.isVIP ?? false,
        isPublic: event.isPublic ?? true,
        isVerified: event.isVerified ?? false,
        verifiedAt: event.verifiedAt ? event.verifiedAt.toISOString() : null,
        verifiedBy: event.verifiedBy ?? null,
        verifiedBadgeImage: event.verifiedBadgeImage ?? null,
    }));
    return {
        events,
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
async function adminGetEventStats() {
    const [total, approved, rejected, pending] = await Promise.all([
        prisma_1.default.event.count(),
        prisma_1.default.event.count({ where: { status: "PUBLISHED" } }),
        prisma_1.default.event.count({ where: { status: "REJECTED" } }),
        prisma_1.default.event.count({ where: { status: "PENDING_APPROVAL" } }),
    ]);
    return { total, approved, rejected, pending };
}
async function adminGetEventById(id) {
    const event = await prisma_1.default.event.findUnique({
        where: { id },
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
                },
            },
            ticketTypes: true,
            exhibitionSpaces: true,
        },
    });
    if (!event)
        return null;
    return {
        ...event,
        subTitle: event.subTitle ?? null,
        edition: event.edition ?? null,
    };
}
async function adminUpdateEvent(id, data) {
    const existing = await prisma_1.default.event.findUnique({
        where: { id },
        select: {
            id: true,
            startDate: true,
            endDate: true,
            previousStartDate: true,
            previousEndDate: true,
        },
    });
    if (!existing) {
        return { error: "NOT_FOUND" };
    }
    let youtubeVideoUrlUpdate;
    if (data.youtubeVideoUrl !== undefined) {
        const normalized = (0, youtube_url_1.normalizeYoutubeVideoUrlForStorage)(data.youtubeVideoUrl);
        if (!normalized.ok) {
            return {
                error: "INVALID_YOUTUBE_URL",
                message: normalized.message,
            };
        }
        youtubeVideoUrlUpdate = normalized.value;
    }
    // Only these fields can be updated; venue/organizer/location are relations and must not be overwritten
    const allowedFields = [
        "title",
        "description",
        "shortDescription",
        "subTitle",
        "slug",
        "edition",
        "status",
        "category",
        "tags",
        "eventType",
        "startDate",
        "endDate",
        "registrationStart",
        "registrationEnd",
        "timezone",
        "maxAttendees",
        "currentAttendees",
        "currency",
        "images",
        "videos",
        "documents",
        "brochure",
        "layoutPlan",
        "bannerImage",
        "vipImage",
        "thumbnailImage",
        "isFeatured",
        "isVIP",
        "isPublic",
        "requiresApproval",
        "allowWaitlist",
        "refundPolicy",
        "metaTitle",
        "metaDescription",
        "isVerified",
        "verifiedBadgeImage",
        "verifiedBy",
    ];
    const raw = {};
    for (const key of allowedFields) {
        if (data[key] !== undefined) {
            raw[key] = data[key];
        }
    }
    // Map frontend status labels to Prisma EventStatus enum (so "Approved" -> PUBLISHED, etc.)
    if (raw.status !== undefined && typeof raw.status === "string") {
        const statusMap = {
            Approved: client_1.EventStatus.PUBLISHED,
            "Pending Review": client_1.EventStatus.PENDING_APPROVAL,
            Draft: client_1.EventStatus.DRAFT,
            Rejected: client_1.EventStatus.REJECTED,
            Flagged: client_1.EventStatus.CANCELLED,
            PUBLISHED: client_1.EventStatus.PUBLISHED,
            PENDING_APPROVAL: client_1.EventStatus.PENDING_APPROVAL,
            DRAFT: client_1.EventStatus.DRAFT,
            REJECTED: client_1.EventStatus.REJECTED,
            CANCELLED: client_1.EventStatus.CANCELLED,
            COMPLETED: client_1.EventStatus.COMPLETED,
        };
        raw.status = statusMap[raw.status] ?? raw.status;
    }
    // Prisma expects category, tags, eventType as String[] — never pass string
    const toStrArray = (v) => {
        if (Array.isArray(v)) {
            return v.filter((x) => typeof x === "string" && String(x).trim() && String(x).trim() !== "—").map((x) => String(x).trim());
        }
        if (typeof v === "string") {
            const s = v.trim();
            if (!s || s === "—" || s === "–" || s === "−")
                return [];
            return [s];
        }
        return [];
    };
    const updateData = { ...raw };
    if (youtubeVideoUrlUpdate !== undefined) {
        updateData.youtubeVideoUrl = youtubeVideoUrlUpdate;
    }
    if (raw.category !== undefined)
        updateData.category = toStrArray(raw.category);
    if (raw.tags !== undefined)
        updateData.tags = toStrArray(raw.tags);
    if (raw.eventType !== undefined)
        updateData.eventType = toStrArray(raw.eventType);
    if (raw.images !== undefined)
        updateData.images = toStrArray(raw.images);
    if (raw.videos !== undefined)
        updateData.videos = toStrArray(raw.videos);
    if (raw.documents !== undefined)
        updateData.documents = toStrArray(raw.documents);
    if (raw.edition !== undefined && raw.edition !== null) {
        updateData.edition = String(raw.edition);
    }
    // Prisma Int fields — only set when valid so we don't overwrite with undefined
    if (raw.maxAttendees !== undefined && raw.maxAttendees !== null) {
        const n = Number(raw.maxAttendees);
        if (!Number.isNaN(n))
            updateData.maxAttendees = n;
    }
    if (raw.currentAttendees !== undefined && raw.currentAttendees !== null) {
        const n = Number(raw.currentAttendees);
        if (!Number.isNaN(n))
            updateData.currentAttendees = n;
    }
    // Prisma DateTime fields — ensure strings are converted to Date
    const dateFields = ["startDate", "endDate", "registrationStart", "registrationEnd", "verifiedAt"];
    for (const key of dateFields) {
        if (updateData[key] !== undefined && updateData[key] !== null) {
            const v = updateData[key];
            updateData[key] = v instanceof Date ? v : new Date(v);
        }
    }
    // When setting isVerified true, set verifiedAt/verifiedBy server-side if not provided
    if (updateData.isVerified === true) {
        if (updateData.verifiedAt === undefined)
            updateData.verifiedAt = new Date();
        const adminId = data.verifiedBy;
        if (adminId)
            updateData.verifiedBy = adminId;
    }
    if (updateData.isVerified === false) {
        updateData.verifiedAt = null;
        updateData.verifiedBy = null;
        updateData.verifiedBadgeImage = null;
    }
    if (existing && (updateData.startDate != null || updateData.endDate != null)) {
        const newStart = updateData.startDate ?? existing.startDate;
        const newEnd = updateData.endDate ?? existing.endDate;
        Object.assign(updateData, (0, event_schedule_1.applyPostponedOnOrganizerDateChange)(existing, newStart, newEnd));
    }
    const ticketTypesPayload = Array.isArray(data.ticketTypes)
        ? data.ticketTypes
        : [];
    if (ticketTypesPayload.length > 0) {
        await prisma_1.default.ticketType.deleteMany({ where: { eventId: id } });
        const normalized = ticketTypesPayload.map((t, i) => ({
            name: String(t?.name ?? `Ticket ${i + 1}`),
            description: String(t?.description ?? ""),
            price: Number(t?.price ?? 0),
            quantity: Number(t?.quantity ?? 100),
            isActive: t?.isActive !== false,
        }));
        updateData.ticketTypes = { create: normalized };
    }
    const event = await prisma_1.default.event.update({
        where: { id },
        data: updateData,
    });
    return { event };
}
/** Toggle verification; optional new badge file uploads to Cloudinary and sets `verifiedBadgeImage` (no default dummy asset). */
async function adminVerifyEvent(eventId, params) {
    const existing = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true, verifiedBadgeImage: true },
    });
    if (!existing) {
        return { error: "NOT_FOUND" };
    }
    if (!params.isVerified) {
        const event = await prisma_1.default.event.update({
            where: { id: eventId },
            data: {
                isVerified: false,
                verifiedAt: null,
                verifiedBy: null,
                verifiedBadgeImage: null,
            },
        });
        return { event };
    }
    let verifiedBadgeImage = existing.verifiedBadgeImage ?? null;
    if (params.badgeBuffer && params.badgeBuffer.length > 0) {
        const uploaded = await (0, cloudinary_service_1.uploadImage)(params.badgeBuffer, "event-badges");
        verifiedBadgeImage = uploaded.secure_url;
    }
    const event = await prisma_1.default.event.update({
        where: { id: eventId },
        data: {
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: params.verifiedBy,
            verifiedBadgeImage,
        },
    });
    return { event };
}
async function adminDeleteEvent(id) {
    const existing = await prisma_1.default.event.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!existing) {
        return { error: "NOT_FOUND" };
    }
    await prisma_1.default.event.delete({
        where: { id },
    });
    return { deleted: true };
}
async function adminApproveEvent(eventId, adminId) {
    const existing = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!existing) {
        return { error: "NOT_FOUND" };
    }
    const now = new Date();
    const event = await prisma_1.default.event.update({
        where: { id: eventId },
        data: {
            status: "PUBLISHED",
            rejectionReason: null,
            rejectedAt: null,
            rejectedById: null,
            isVerified: true,
            verifiedAt: now,
            verifiedBy: adminId,
        },
    });
    return { event };
}
async function adminRejectEvent(eventId, adminId, reason) {
    const existing = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!existing) {
        return { error: "NOT_FOUND" };
    }
    const now = new Date();
    const event = await prisma_1.default.event.update({
        where: { id: eventId },
        data: {
            status: "REJECTED",
            rejectionReason: reason ?? "Rejected by admin",
            rejectedAt: now,
            rejectedById: adminId,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
        },
    });
    return { event };
}
async function adminListVenues() {
    const venues = await prisma_1.default.user.findMany({
        where: { role: "VENUE_MANAGER" },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            venueName: true,
            venueCity: true,
            venueState: true,
            venueCountry: true,
            venueAddress: true,
            maxCapacity: true,
            totalHalls: true,
            averageRating: true,
            totalReviews: true,
            activeBookings: true,
            isActive: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
    return venues;
}
async function adminListVisitors() {
    const registrations = await prisma_1.default.eventRegistration.findMany({
        where: {
            status: "CONFIRMED",
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
                    startDate: true,
                },
            },
        },
        orderBy: { registeredAt: "desc" },
        take: 200,
    });
    return registrations;
}
function buildLast30DaysTrend(events, regs) {
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        days.push({
            key,
            label: `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`,
            eventsCreated: 0,
            publishedEvents: 0,
            registrations: 0,
        });
    }
    const dayMap = new Map(days.map((x) => [x.key, x]));
    for (const e of events) {
        const k = e.createdAt.toISOString().slice(0, 10);
        const row = dayMap.get(k);
        if (row) {
            row.eventsCreated += 1;
            if (e.status === "PUBLISHED")
                row.publishedEvents += 1;
        }
    }
    for (const r of regs) {
        const k = r.registeredAt.toISOString().slice(0, 10);
        const row = dayMap.get(k);
        if (row)
            row.registrations += 1;
    }
    return days;
}
const EVENT_STATUS_DONUT_COLORS = {
    PUBLISHED: "#22c55e",
    PENDING_APPROVAL: "#f97316",
    DRAFT: "#94a3b8",
    REJECTED: "#ef4444",
    CANCELLED: "#64748b",
    COMPLETED: "#3b82f6",
};
async function adminGetDashboardSummary() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const eventCardSelect = {
        id: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        slug: true,
        city: true,
        country: true,
        isVirtual: true,
        bannerImage: true,
        thumbnailImage: true,
        images: true,
        currentAttendees: true,
        maxAttendees: true,
    };
    const [totalEvents, publishedEvents, organizers, exhibitors, venues, attendees, recentEvents, recentRegistrations, eventsForTrend, regsForTrend, statusBreakdown, topEventsByAttendees, revenueSum, upcomingEvents,] = await Promise.all([
        prisma_1.default.event.count(),
        prisma_1.default.event.count({ where: { status: "PUBLISHED" } }),
        prisma_1.default.user.count({ where: { role: "ORGANIZER" } }),
        prisma_1.default.user.count({ where: { role: "EXHIBITOR" } }),
        prisma_1.default.user.count({ where: { role: "VENUE_MANAGER" } }),
        prisma_1.default.user.count({ where: { role: "ATTENDEE" } }),
        prisma_1.default.event.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: eventCardSelect,
        }),
        prisma_1.default.eventRegistration.findMany({
            where: { status: "CONFIRMED" },
            orderBy: { registeredAt: "desc" },
            take: 5,
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
                    select: eventCardSelect,
                },
            },
        }),
        prisma_1.default.event.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true, status: true },
        }),
        prisma_1.default.eventRegistration.findMany({
            where: { registeredAt: { gte: thirtyDaysAgo }, status: "CONFIRMED" },
            select: { registeredAt: true },
        }),
        prisma_1.default.event.groupBy({
            by: ["status"],
            _count: { id: true },
        }),
        prisma_1.default.event.findMany({
            orderBy: { currentAttendees: "desc" },
            take: 5,
            select: {
                id: true,
                title: true,
                currentAttendees: true,
                maxAttendees: true,
            },
        }),
        prisma_1.default.eventRegistration.aggregate({
            where: { status: "CONFIRMED" },
            _sum: { totalAmount: true },
        }),
        prisma_1.default.event.findMany({
            where: {
                startDate: { gte: new Date() },
                status: { in: ["PUBLISHED", "PENDING_APPROVAL"] },
            },
            orderBy: { startDate: "asc" },
            take: 8,
            select: eventCardSelect,
        }),
    ]);
    const trend = buildLast30DaysTrend(eventsForTrend, regsForTrend);
    const registrationsByStatus = statusBreakdown
        .filter((row) => (row._count.id ?? 0) > 0)
        .map((row) => ({
        name: toStatusLabel(row.status),
        status: row.status,
        value: row._count.id,
        color: EVENT_STATUS_DONUT_COLORS[row.status] ?? "#94a3b8",
    }));
    const topEvents = topEventsByAttendees.map((e) => ({
        id: e.id,
        title: e.title,
        registrations: e.currentAttendees,
        maxAttendees: e.maxAttendees,
    }));
    const revenueTotal = revenueSum._sum.totalAmount ?? 0;
    return {
        totals: {
            totalEvents,
            publishedEvents,
            organizers,
            exhibitors,
            venues,
            attendees,
        },
        recentEvents,
        recentRegistrations,
        upcomingEvents,
        dashboardCharts: {
            trend,
        },
        registrationsByStatus,
        topEvents,
        revenue: {
            total: revenueTotal,
            currency: "USD",
        },
    };
}
async function adminListEventCategories() {
    const events = await prisma_1.default.event.findMany({
        select: { category: true },
    });
    const countByCategory = {};
    for (const e of events) {
        const cats = Array.isArray(e.category) ? e.category : [];
        for (const c of cats) {
            const name = String(c || "").trim();
            if (!name)
                continue;
            countByCategory[name] = (countByCategory[name] ?? 0) + 1;
        }
    }
    return Object.entries(countByCategory).map(([name]) => ({
        id: name,
        name,
        eventCount: countByCategory[name],
        isActive: true,
    }));
}
function asObject(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function asString(v) {
    return typeof v === "string" ? v : "";
}
async function adminGetEventMailCandidates() {
    const [subAdminLogs, importJobs] = await Promise.all([
        prisma_1.default.adminLog.findMany({
            where: {
                action: "EVENT_CREATED",
                adminType: "SUB_ADMIN",
            },
            orderBy: { createdAt: "desc" },
            select: {
                createdAt: true,
                details: true,
            },
            take: 300,
        }),
        prisma_1.default.eventImportJob.findMany({
            where: { status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            select: {
                createdAt: true,
                importedSummary: true,
            },
            take: 120,
        }),
    ]);
    const organizerIds = new Set();
    for (const row of subAdminLogs) {
        const d = asObject(row.details);
        const organizerId = asString(d.organizerId);
        if (organizerId)
            organizerIds.add(organizerId);
    }
    const users = organizerIds.size
        ? await prisma_1.default.user.findMany({
            where: { id: { in: Array.from(organizerIds) } },
            select: { id: true, email: true, firstName: true, lastName: true },
        })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const out = [];
    for (const row of subAdminLogs) {
        const d = asObject(row.details);
        const title = asString(d.title);
        const organizerId = asString(d.organizerId);
        const organizer = organizerId ? userMap.get(organizerId) : null;
        const email = organizer?.email || "";
        if (!title || !email)
            continue;
        out.push({
            source: "SUB_ADMIN",
            eventTitle: title,
            organizerEmail: email,
            organizerName: [organizer?.firstName, organizer?.lastName].filter(Boolean).join(" ").trim() || "Organizer",
            createdAt: row.createdAt.toISOString(),
        });
    }
    for (const job of importJobs) {
        const items = Array.isArray(job.importedSummary) ? job.importedSummary : [];
        for (const item of items) {
            const row = asObject(item);
            const title = asString(row.title);
            const email = asString(row.organizerEmail).toLowerCase();
            if (!title || !email)
                continue;
            out.push({
                source: "BULK_UPLOAD",
                eventTitle: title,
                organizerEmail: email,
                organizerName: "Organizer",
                createdAt: job.createdAt.toISOString(),
            });
        }
    }
    return out.slice(0, 500);
}
async function adminSendEventListingEmail(params) {
    const organizerEmail = params.organizerEmail.trim().toLowerCase();
    const eventTitles = params.eventTitles.map((t) => t.trim()).filter(Boolean);
    if (!organizerEmail || eventTitles.length === 0) {
        throw new Error("organizerEmail and eventTitles are required");
    }
    const organizer = await prisma_1.default.user.findFirst({
        where: { email: organizerEmail, role: "ORGANIZER" },
        select: { id: true, firstName: true },
    });
    if (!organizer) {
        throw new Error("Organizer not found");
    }
    const resetToken = (0, crypto_1.randomBytes)(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await prisma_1.default.user.update({
        where: { id: organizer.id },
        data: { resetToken, resetTokenExpiry },
    });
    const base = (0, email_service_1.resolveFrontendBase)().replace(/\/$/, "");
    const resetPasswordUrl = `${base}/reset-password?token=${resetToken}&email=${encodeURIComponent(organizerEmail)}`;
    await (0, email_service_1.sendEventListingThankYouEmail)({
        toEmail: organizerEmail,
        firstName: organizer.firstName || "there",
        eventTitles,
        resetPasswordUrl,
    });
}
