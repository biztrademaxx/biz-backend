"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVenueEventsForAdmin = listVenueEventsForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const ROLE = "VENUE_MANAGER";
async function listVenueEventsForAdmin() {
    const venues = await prisma_1.default.user.findMany({
        where: { role: ROLE },
        select: {
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
        },
    });
    const now = new Date();
    return venues.map((v) => {
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
    });
}
