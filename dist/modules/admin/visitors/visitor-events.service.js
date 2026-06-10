"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVisitorEventsForAdmin = listVisitorEventsForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const ATTENDEE_LEAD_TYPES = ["attendee", "visitor", "visit", "guest", "ATTENDEE", "VISITOR"];
function normalizeRegistrationStatus(status) {
    const s = String(status ?? "PENDING").toUpperCase().trim();
    if (["CONFIRMED", "COMPLETED", "APPROVED", "ACTIVE", "PAID"].includes(s))
        return "CONFIRMED";
    if (["CANCELLED", "CANCELED", "REJECTED", "DECLINED"].includes(s))
        return "CANCELLED";
    if (["WAITLISTED", "WAITLIST", "WAITING"].includes(s))
        return "WAITLISTED";
    if (["NEW", "PENDING", "INTERESTED"].includes(s))
        return "PENDING";
    return s;
}
function countByStatus(regs, status) {
    return regs.filter((r) => normalizeRegistrationStatus(r.status) === status).length;
}
async function listVisitorEventsForAdmin() {
    const [registrations, leads] = await Promise.all([
        prisma_1.default.eventRegistration.findMany({
            orderBy: { registeredAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        avatar: true,
                        role: true,
                    },
                },
                event: {
                    select: {
                        id: true,
                        title: true,
                        startDate: true,
                        endDate: true,
                    },
                },
            },
        }),
        prisma_1.default.eventLead.findMany({
            where: {
                userId: { not: null },
                eventId: { not: null },
                type: { in: ATTENDEE_LEAD_TYPES },
            },
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        avatar: true,
                        role: true,
                    },
                },
                event: {
                    select: {
                        id: true,
                        title: true,
                        startDate: true,
                        endDate: true,
                    },
                },
            },
        }),
    ]);
    const byUser = new Map();
    const ensureUser = (user) => {
        let bucket = byUser.get(user.id);
        if (!bucket) {
            bucket = {
                visitor: {
                    id: user.id,
                    name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Visitor",
                    email: user.email ?? "",
                    phone: user.phone ?? null,
                    avatar: user.avatar ?? null,
                },
                registrations: [],
                seenEventKeys: new Set(),
            };
            byUser.set(user.id, bucket);
        }
        return bucket;
    };
    for (const r of registrations) {
        if (!r.user || !r.eventId)
            continue;
        const bucket = ensureUser(r.user);
        const key = r.eventId;
        if (bucket.seenEventKeys.has(key))
            continue;
        bucket.seenEventKeys.add(key);
        bucket.registrations.push({
            id: r.id,
            eventId: r.eventId,
            eventTitle: r.event?.title ?? "",
            eventDate: r.event?.startDate?.toISOString() ?? "",
            status: normalizeRegistrationStatus(r.status),
            registeredAt: r.registeredAt.toISOString(),
            ticketType: r.ticketTypeId ?? "",
            totalAmount: r.totalAmount ?? 0,
            source: "registration",
        });
    }
    for (const lead of leads) {
        if (!lead.user || !lead.eventId)
            continue;
        const bucket = ensureUser(lead.user);
        const key = lead.eventId;
        if (bucket.seenEventKeys.has(key))
            continue;
        bucket.seenEventKeys.add(key);
        bucket.registrations.push({
            id: lead.id,
            eventId: lead.eventId,
            eventTitle: lead.event?.title ?? "",
            eventDate: lead.event?.startDate?.toISOString() ?? "",
            status: normalizeRegistrationStatus(lead.status),
            registeredAt: lead.createdAt.toISOString(),
            ticketType: lead.ticketTypeId ?? "",
            totalAmount: 0,
            source: "lead",
        });
    }
    return Array.from(byUser.values())
        .filter((b) => b.registrations.length > 0)
        .map((b) => {
        const regs = b.registrations;
        return {
            id: b.visitor.id,
            visitor: b.visitor,
            registrations: regs.map(({ source: _source, ...rest }) => rest),
            stats: {
                totalRegistrations: regs.length,
                confirmedEvents: countByStatus(regs, "CONFIRMED"),
                pendingEvents: countByStatus(regs, "PENDING"),
                cancelledEvents: countByStatus(regs, "CANCELLED"),
            },
        };
    })
        .sort((a, b) => b.stats.totalRegistrations - a.stats.totalRegistrations);
}
