"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventNetwork = getEventNetwork;
const prisma_1 = __importDefault(require("../../config/prisma"));
// Use string literals for status (Prisma enum may not be in generated client types in some setups)
const ACCEPTED = "ACCEPTED";
const PENDING = "PENDING";
const userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    avatar: true,
    company: true,
    role: true,
};
function toName(firstName, lastName) {
    return [firstName, lastName].filter(Boolean).join(" ").trim() || "User";
}
function toNetworkUser(user, connectionStatus) {
    return {
        userId: user.id,
        name: toName(user.firstName, user.lastName),
        avatar: user.avatar,
        company: user.company,
        role: user.role,
        connectionStatus,
    };
}
/**
 * Get networkable users for an event, grouped by role (speakers, exhibitors, attendees, organizers).
 * Excludes the current user. Includes connection status for each user relative to currentUser.
 * Optimized: single event lookup, bulk participant queries, single connection query.
 */
async function getEventNetwork(eventId, currentUserId) {
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true, organizerId: true },
    });
    if (!event) {
        throw new Error("Event not found");
    }
    const excludeIds = new Set([currentUserId, event.organizerId].filter(Boolean));
    const [speakerRows, exhibitorRows, attendeeRows, connections] = await Promise.all([
        prisma_1.default.speakerSession.findMany({
            where: { eventId },
            select: { speakerId: true },
            distinct: ["speakerId"],
        }),
        prisma_1.default.exhibitorBooth.findMany({
            where: { eventId },
            select: { exhibitorId: true },
            distinct: ["exhibitorId"],
        }),
        prisma_1.default.eventRegistration.findMany({
            where: { eventId },
            select: { userId: true },
            distinct: ["userId"],
        }),
        prisma_1.default.connection.findMany({
            where: {
                OR: [
                    { requesterId: currentUserId },
                    { receiverId: currentUserId },
                ],
            },
            select: {
                requesterId: true,
                receiverId: true,
                status: true,
            },
        }),
    ]);
    const connectionMap = new Map();
    for (const c of connections) {
        const otherId = c.requesterId === currentUserId ? c.receiverId : c.requesterId;
        if (c.status === ACCEPTED) {
            connectionMap.set(otherId, "CONNECTED");
        }
        else if (c.status === PENDING) {
            const status = c.requesterId === currentUserId ? "PENDING_SENT" : "PENDING_RECEIVED";
            connectionMap.set(otherId, status);
        }
        else {
            connectionMap.set(otherId, "NOT_CONNECTED");
        }
    }
    const speakerIds = new Set(speakerRows.map((r) => r.speakerId).filter((id) => !excludeIds.has(id)));
    const exhibitorIds = new Set(exhibitorRows.map((r) => r.exhibitorId).filter((id) => !excludeIds.has(id)));
    const attendeeIds = new Set(attendeeRows.map((r) => r.userId).filter((id) => !excludeIds.has(id)));
    const exhibitorIdsOnly = new Set([...exhibitorIds].filter((id) => !speakerIds.has(id)));
    const attendeeIdsOnly = new Set([...attendeeIds].filter((id) => !speakerIds.has(id) && !exhibitorIds.has(id)));
    const allUserIds = new Set([
        event.organizerId,
        ...speakerIds,
        ...exhibitorIdsOnly,
        ...attendeeIdsOnly,
    ].filter((id) => !!id && id !== currentUserId));
    if (allUserIds.size === 0) {
        const organizerUser = event.organizerId && event.organizerId !== currentUserId
            ? await prisma_1.default.user.findUnique({
                where: { id: event.organizerId },
                select: userSelect,
            })
            : null;
        const connectionStatus = organizerUser
            ? connectionMap.get(organizerUser.id) ?? "NOT_CONNECTED"
            : "NOT_CONNECTED";
        return {
            speakers: [],
            exhibitors: [],
            attendees: [],
            organizers: organizerUser ? [toNetworkUser(organizerUser, connectionStatus)] : [],
        };
    }
    const users = await prisma_1.default.user.findMany({
        where: { id: { in: [...allUserIds] } },
        select: userSelect,
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const organizers = [];
    if (event.organizerId && event.organizerId !== currentUserId) {
        const u = userMap.get(event.organizerId);
        if (u) {
            organizers.push(toNetworkUser(u, connectionMap.get(u.id) ?? "NOT_CONNECTED"));
        }
    }
    const speakers = [];
    for (const id of speakerIds) {
        const u = userMap.get(id);
        if (u) {
            speakers.push(toNetworkUser(u, connectionMap.get(u.id) ?? "NOT_CONNECTED"));
        }
    }
    const exhibitors = [];
    for (const id of exhibitorIdsOnly) {
        const u = userMap.get(id);
        if (u) {
            exhibitors.push(toNetworkUser(u, connectionMap.get(u.id) ?? "NOT_CONNECTED"));
        }
    }
    const attendees = [];
    for (const id of attendeeIdsOnly) {
        const u = userMap.get(id);
        if (u) {
            attendees.push(toNetworkUser(u, connectionMap.get(u.id) ?? "NOT_CONNECTED"));
        }
    }
    return {
        speakers,
        exhibitors,
        attendees,
        organizers,
    };
}
