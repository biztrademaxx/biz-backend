"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVisitors = listVisitors;
exports.getVisitorById = getVisitorById;
exports.updateVisitor = updateVisitor;
exports.deleteVisitor = deleteVisitor;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
const ROLE = "ATTENDEE";
function isUuid(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
async function listVisitors(query) {
    const { page, limit, search, skip, sort, order } = (0, admin_response_1.parseListQuery)(query);
    const where = { role: ROLE };
    if (search) {
        where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
        ];
    }
    const status = typeof query.status === "string" ? query.status : undefined;
    if (status === "active")
        where.isActive = true;
    if (status === "inactive")
        where.isActive = false;
    if (status === "verified")
        where.isVerified = true;
    if (status === "unverified")
        where.isVerified = false;
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
                avatar: true,
                company: true,
                jobTitle: true,
                location: true,
                bio: true,
                website: true,
                linkedin: true,
                twitter: true,
                instagram: true,
                isVerified: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        registrations: true,
                        appointmentsAsRequester: true,
                        savedEvents: true,
                    },
                },
            },
        }),
        prisma_1.default.user.count({ where }),
    ]);
    const userIds = items.map((u) => u.id);
    const [connections, appointments, confirmedRegCounts] = await Promise.all([
        prisma_1.default.connection.findMany({
            where: {
                OR: [
                    { requesterId: { in: userIds } },
                    { receiverId: { in: userIds } },
                ],
            },
            select: { requesterId: true, receiverId: true, status: true },
        }),
        prisma_1.default.appointment.findMany({
            where: { requesterId: { in: userIds } },
            select: { requesterId: true, status: true },
        }),
        prisma_1.default.eventRegistration.groupBy({
            by: ["userId"],
            where: {
                userId: { in: userIds },
                status: { in: ["CONFIRMED", "Confirmed", "confirmed"] },
            },
            _count: true,
        }),
    ]);
    const connectionMap = {};
    for (const id of userIds)
        connectionMap[id] = { accepted: 0, pending: 0 };
    for (const c of connections) {
        const uid = userIds.includes(c.requesterId) ? c.requesterId : c.receiverId;
        if (c.status === "ACCEPTED")
            connectionMap[uid].accepted += 1;
        if (c.status === "PENDING")
            connectionMap[uid].pending += 1;
    }
    const appointmentMap = {};
    for (const id of userIds)
        appointmentMap[id] = { total: 0, completed: 0 };
    for (const a of appointments) {
        appointmentMap[a.requesterId].total += 1;
        if (a.status === "CONFIRMED" || a.status === "COMPLETED")
            appointmentMap[a.requesterId].completed += 1;
    }
    const regConfirmedMap = {};
    for (const r of confirmedRegCounts)
        regConfirmedMap[r.userId] = r._count;
    const visitors = items.map((u) => {
        const conn = connectionMap[u.id] ?? { accepted: 0, pending: 0 };
        const appt = appointmentMap[u.id] ?? { total: 0, completed: 0 };
        const totalReg = u._count.registrations ?? 0;
        const confirmedReg = regConfirmedMap[u.id] ?? 0;
        return {
            id: u.id,
            name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Visitor",
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone ?? undefined,
            avatar: u.avatar ?? undefined,
            company: u.company ?? undefined,
            jobTitle: u.jobTitle ?? undefined,
            location: u.location ?? undefined,
            bio: u.bio ?? undefined,
            website: u.website ?? undefined,
            social: {
                linkedin: u.linkedin ?? undefined,
                twitter: u.twitter ?? undefined,
                instagram: u.instagram ?? undefined,
            },
            isVerified: u.isVerified ?? false,
            isActive: u.isActive ?? true,
            lastLogin: u.lastLogin?.toISOString(),
            createdAt: u.createdAt.toISOString(),
            updatedAt: u.updatedAt.toISOString(),
            stats: {
                totalRegistrations: totalReg,
                confirmedRegistrations: confirmedReg,
                totalConnections: conn.accepted + conn.pending,
                acceptedConnections: conn.accepted,
                totalAppointments: appt.total,
                completedAppointments: appt.completed,
                savedEvents: u._count.savedEvents ?? 0,
            },
        };
    });
    return {
        data: { visitors, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    };
}
async function getVisitorById(id) {
    if (!isUuid(id))
        return null;
    const user = await prisma_1.default.user.findFirst({
        where: { id, role: ROLE },
        include: {
            registrations: {
                include: { event: { select: { id: true, title: true, startDate: true, endDate: true } } },
            },
            savedEvents: { include: { event: { select: { id: true, title: true, startDate: true } } } },
        },
    });
    if (!user)
        return null;
    const [connAsRequester, connAsReceiver, appointments] = await Promise.all([
        prisma_1.default.connection.findMany({
            where: { requesterId: id },
            include: { receiver: { select: { id: true, firstName: true, lastName: true, email: true, company: true } } },
        }),
        prisma_1.default.connection.findMany({
            where: { receiverId: id },
            include: { requester: { select: { id: true, firstName: true, lastName: true, email: true, company: true } } },
        }),
        prisma_1.default.appointment.findMany({
            where: { requesterId: id },
            include: {
                event: { select: { id: true, title: true } },
                exhibitor: { select: { id: true, firstName: true, lastName: true, company: true } },
            },
        }),
    ]);
    const connections = [
        ...connAsRequester.map((c) => ({
            id: c.id,
            type: "sent",
            user: c.receiver
                ? {
                    id: c.receiver.id,
                    name: `${c.receiver.firstName ?? ""} ${c.receiver.lastName ?? ""}`.trim(),
                    email: c.receiver.email,
                    company: c.receiver.company ?? undefined,
                }
                : null,
            status: c.status,
            createdAt: c.createdAt.toISOString(),
        })),
        ...connAsReceiver.map((c) => ({
            id: c.id,
            type: "received",
            user: c.requester
                ? {
                    id: c.requester.id,
                    name: `${c.requester.firstName ?? ""} ${c.requester.lastName ?? ""}`.trim(),
                    email: c.requester.email,
                    company: c.requester.company ?? undefined,
                }
                : null,
            status: c.status,
            createdAt: c.createdAt.toISOString(),
        })),
    ];
    const regCount = user.registrations?.length ?? 0;
    const confirmedReg = user.registrations?.filter((r) => r.status && ["CONFIRMED", "Confirmed", "confirmed"].includes(r.status)).length ?? 0;
    const connAccepted = [...connAsRequester, ...connAsReceiver].filter((c) => c.status === "ACCEPTED").length;
    const apptCompleted = appointments.filter((a) => a.status === "CONFIRMED" || a.status === "COMPLETED").length;
    return {
        id: user.id,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Visitor",
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? undefined,
        avatar: user.avatar ?? undefined,
        company: user.company ?? undefined,
        jobTitle: user.jobTitle ?? undefined,
        location: user.location ?? undefined,
        bio: user.bio ?? undefined,
        website: user.website ?? undefined,
        social: {
            linkedin: user.linkedin ?? undefined,
            twitter: user.twitter ?? undefined,
            instagram: user.instagram ?? undefined,
        },
        isVerified: user.isVerified ?? false,
        isActive: user.isActive ?? true,
        lastLogin: user.lastLogin?.toISOString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        stats: {
            totalRegistrations: regCount,
            confirmedRegistrations: confirmedReg,
            totalConnections: connAsRequester.length + connAsReceiver.length,
            acceptedConnections: connAccepted,
            totalAppointments: appointments.length,
            completedAppointments: apptCompleted,
            savedEvents: user.savedEvents?.length ?? 0,
        },
        registrations: (user.registrations ?? []).map((r) => ({
            id: r.id,
            event: r.event
                ? {
                    id: r.event.id,
                    title: r.event.title,
                    startDate: r.event.startDate.toISOString(),
                    endDate: r.event.endDate.toISOString(),
                }
                : null,
            status: r.status ?? "PENDING",
            registeredAt: r.registeredAt.toISOString(),
        })),
        connections,
        appointments: appointments.map((a) => ({
            id: a.id,
            title: a.title,
            exhibitor: a.exhibitor
                ? {
                    id: a.exhibitor.id,
                    name: `${a.exhibitor.firstName ?? ""} ${a.exhibitor.lastName ?? ""}`.trim(),
                    company: a.exhibitor.company ?? undefined,
                }
                : null,
            event: a.event ? { id: a.event.id, title: a.event.title } : null,
            status: a.status,
            requestedDate: a.requestedDate.toISOString(),
        })),
        savedEvents: (user.savedEvents ?? []).map((s) => ({
            id: s.id,
            event: s.event
                ? { id: s.event.id, title: s.event.title, startDate: s.event.startDate.toISOString() }
                : null,
        })),
    };
}
async function updateVisitor(id, body) {
    if (!isUuid(id))
        return null;
    const user = await prisma_1.default.user.findFirst({ where: { id, role: ROLE } });
    if (!user)
        return null;
    const updated = await prisma_1.default.user.update({
        where: { id },
        data: { isActive: body.isActive ?? user.isActive },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return {
        id: updated.id,
        name: `${updated.firstName ?? ""} ${updated.lastName ?? ""}`.trim(),
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
    };
}
async function deleteVisitor(id) {
    if (!isUuid(id))
        return false;
    const user = await prisma_1.default.user.findFirst({ where: { id, role: ROLE } });
    if (!user)
        return false;
    await prisma_1.default.user.delete({ where: { id } });
    return true;
}
