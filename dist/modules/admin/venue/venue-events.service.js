"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVenueEventsForAdmin = listVenueEventsForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
const ROLE = "VENUE_MANAGER";
const venueSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    venueName: true,
    venueCity: true,
    averageRating: true,
    totalReviews: true,
    venueEvents: {
        select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            organizerId: true,
            organizer: {
                select: { id: true, firstName: true, lastName: true, email: true },
            },
        },
    },
};
function mapVenueToDto(v) {
    const now = new Date();
    const events = v.venueEvents || [];
    const upcoming = events.filter((e) => new Date(e.startDate) > now).length;
    const completed = events.filter((e) => new Date(e.endDate) < now).length;
    const active = events.filter((e) => {
        const start = new Date(e.startDate);
        const end = new Date(e.endDate);
        return start <= now && end >= now;
    }).length;
    return {
        id: v.id,
        venueId: v.id,
        venueName: (v.venueName ?? `${v.firstName ?? ""} ${v.lastName ?? ""}`.trim()) || "Venue",
        venueEmail: v.email ?? "",
        venuePhone: v.phone ?? "",
        venueCity: v.venueCity ?? "",
        totalEvents: events.length,
        upcomingEvents: upcoming,
        completedEvents: completed,
        activeEvents: active,
        totalRevenue: 0,
        averageRating: v.averageRating != null ? Number(v.averageRating) : 0,
        totalReviews: v.totalReviews ?? 0,
        events: events.map((e) => ({
            id: e.id,
            title: e.title,
            status: e.status,
            startDate: e.startDate.toISOString(),
            endDate: e.endDate.toISOString(),
            category: [],
            attendees: 0,
            organizerName: e.organizer
                ? `${e.organizer.firstName ?? ""} ${e.organizer.lastName ?? ""}`.trim() || "Organizer"
                : "",
            organizerEmail: e.organizer?.email ?? "",
        })),
    };
}
function buildVenueWhere(search, status) {
    const now = new Date();
    const where = { role: ROLE };
    if (search) {
        where.OR = [
            { venueName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { venueCity: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
        ];
    }
    if (status === "active") {
        where.venueEvents = { some: { startDate: { lte: now }, endDate: { gte: now } } };
    }
    else if (status === "upcoming") {
        where.venueEvents = { some: { startDate: { gt: now } } };
    }
    else if (status === "completed") {
        where.venueEvents = { some: { endDate: { lt: now } } };
    }
    return where;
}
async function listVenueEventsForAdmin(query = {}) {
    const { page, limit, search, status, skip } = (0, admin_response_1.parseListQuery)(query);
    const now = new Date();
    const where = buildVenueWhere(search, status);
    const [venues, total, totalVenues, totalEvents, activeEvents] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { venueName: "asc" },
            select: venueSelect,
        }),
        prisma_1.default.user.count({ where }),
        prisma_1.default.user.count({ where: { role: ROLE } }),
        prisma_1.default.event.count({ where: { venueId: { not: null } } }),
        prisma_1.default.event.count({
            where: { venueId: { not: null }, startDate: { lte: now }, endDate: { gte: now } },
        }),
    ]);
    return {
        data: venues.map(mapVenueToDto),
        pagination: {
            page,
            limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
        stats: {
            totalVenues,
            totalEvents,
            activeEvents,
        },
    };
}
