"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVisitorEventsForAdmin = listVisitorEventsForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const ROLE = "ATTENDEE";
async function listVisitorEventsForAdmin() {
    const users = await prisma_1.default.user.findMany({
        where: { role: ROLE },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            registrations: {
                select: {
                    id: true,
                    eventId: true,
                    status: true,
                    registeredAt: true,
                    ticketTypeId: true,
                    totalAmount: true,
                    event: {
                        select: {
                            id: true,
                            title: true,
                            startDate: true,
                            endDate: true,
                        },
                    },
                },
            },
        },
    });
    return users.map((u) => {
        const regs = u.registrations ?? [];
        const totalRegistrations = regs.length;
        const confirmedEvents = regs.filter((r) => r.status && ["CONFIRMED", "Confirmed", "confirmed"].includes(r.status)).length;
        const pendingEvents = regs.filter((r) => r.status && ["PENDING", "Pending", "pending"].includes(r.status)).length;
        const cancelledEvents = regs.filter((r) => r.status && ["CANCELLED", "Cancelled", "cancelled"].includes(r.status)).length;
        return {
            id: u.id,
            visitor: {
                id: u.id,
                name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Visitor",
                email: u.email ?? "",
                phone: u.phone ?? null,
                avatar: u.avatar ?? null,
            },
            registrations: regs.map((r) => ({
                id: r.id,
                eventId: r.eventId,
                eventTitle: r.event?.title ?? "",
                eventDate: r.event?.startDate?.toISOString() ?? "",
                status: r.status ?? "PENDING",
                registeredAt: r.registeredAt.toISOString(),
                ticketType: r.ticketTypeId ?? "",
                totalAmount: r.totalAmount ?? 0,
            })),
            stats: {
                totalRegistrations,
                confirmedEvents,
                pendingEvents,
                cancelledEvents,
            },
        };
    });
}
