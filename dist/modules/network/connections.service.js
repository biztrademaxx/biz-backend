"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConnections = listConnections;
exports.listConnectionRequests = listConnectionRequests;
exports.requestConnection = requestConnection;
exports.acceptConnection = acceptConnection;
exports.rejectConnection = rejectConnection;
exports.deleteConnection = deleteConnection;
const prisma_1 = __importDefault(require("../../config/prisma"));
const client_1 = require("@prisma/client");
// ─── List connections (accepted + pending outgoing) for the current user ──────
async function listConnections(userId) {
    const connections = await prisma_1.default.connection.findMany({
        where: {
            OR: [
                { status: client_1.ConnectionStatus.ACCEPTED, OR: [{ requesterId: userId }, { receiverId: userId }] },
                { status: client_1.ConnectionStatus.PENDING, requesterId: userId },
            ],
        },
        include: {
            requester: {
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
            },
            receiver: {
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
            },
        },
        orderBy: { updatedAt: "desc" },
    });
    return connections.map((c) => {
        const other = c.requesterId === userId ? c.receiver : c.requester;
        const status = c.status === client_1.ConnectionStatus.ACCEPTED
            ? "connected"
            : c.status === client_1.ConnectionStatus.PENDING && c.requesterId === userId
                ? "pending"
                : "connected";
        return {
            connectionId: c.id,
            id: other?.id ?? c.id,
            status,
            requesterId: c.requesterId,
            receiverId: c.receiverId,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            firstName: other?.firstName ?? "",
            lastName: other?.lastName ?? "",
            email: other?.email ?? undefined,
            avatar: other?.avatar ?? undefined,
            role: other?.role,
            company: other?.company ?? undefined,
            jobTitle: other?.jobTitle ?? undefined,
            lastLogin: other?.lastLogin?.toISOString() ?? undefined,
        };
    });
}
// ─── List pending connection requests (received by current user) ─────────────
async function listConnectionRequests(userId) {
    const connections = await prisma_1.default.connection.findMany({
        where: {
            receiverId: userId,
            status: client_1.ConnectionStatus.PENDING,
        },
        include: {
            requester: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    role: true,
                    company: true,
                    jobTitle: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return connections.map((c) => ({
        id: c.requester.id,
        connectionId: c.id,
        status: "request_received",
        requesterId: c.requesterId,
        receiverId: c.receiverId,
        firstName: c.requester.firstName,
        lastName: c.requester.lastName,
        email: c.requester.email ?? undefined,
        avatar: c.requester.avatar ?? undefined,
        role: c.requester.role,
        company: c.requester.company ?? undefined,
        jobTitle: c.requester.jobTitle ?? undefined,
        createdAt: c.createdAt.toISOString(),
    }));
}
// ─── Send connection request ───────────────────────────────────────────────
async function requestConnection(requesterId, receiverId) {
    if (requesterId === receiverId) {
        throw new Error("Cannot send connection request to yourself");
    }
    const [requester, receiver] = await Promise.all([
        prisma_1.default.user.findUnique({ where: { id: requesterId }, select: { id: true } }),
        prisma_1.default.user.findUnique({ where: { id: receiverId }, select: { id: true } }),
    ]);
    if (!requester)
        throw new Error("Requester not found");
    if (!receiver)
        throw new Error("Receiver not found");
    const existing = await prisma_1.default.connection.findUnique({
        where: {
            requesterId_receiverId: {
                requesterId: requesterId,
                receiverId: receiverId,
            },
        },
    });
    if (existing) {
        if (existing.status === client_1.ConnectionStatus.PENDING) {
            throw new Error("Connection request already sent");
        }
        if (existing.status === client_1.ConnectionStatus.ACCEPTED) {
            throw new Error("Already connected");
        }
        if (existing.status === client_1.ConnectionStatus.REJECTED || existing.status === client_1.ConnectionStatus.BLOCKED) {
            throw new Error("Cannot send request to this user");
        }
    }
    // Check reverse direction (receiver might have sent request to requester)
    const reverse = await prisma_1.default.connection.findUnique({
        where: {
            requesterId_receiverId: {
                requesterId: receiverId,
                receiverId: requesterId,
            },
        },
    });
    if (reverse?.status === client_1.ConnectionStatus.PENDING) {
        throw new Error("This user has already sent you a connection request. Accept it instead.");
    }
    if (reverse?.status === client_1.ConnectionStatus.ACCEPTED) {
        throw new Error("Already connected");
    }
    const connection = await prisma_1.default.connection.create({
        data: {
            requesterId,
            receiverId,
            status: client_1.ConnectionStatus.PENDING,
        },
        include: {
            requester: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    role: true,
                    company: true,
                    jobTitle: true,
                },
            },
            receiver: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    role: true,
                    company: true,
                    jobTitle: true,
                },
            },
        },
    });
    return {
        connection: {
            id: connection.receiver.id,
            connectionId: connection.id,
            status: "pending",
            requesterId: connection.requesterId,
            receiverId: connection.receiverId,
            firstName: connection.receiver.firstName,
            lastName: connection.receiver.lastName,
            email: connection.receiver.email ?? undefined,
            avatar: connection.receiver.avatar ?? undefined,
            role: connection.receiver.role,
            company: connection.receiver.company ?? undefined,
            jobTitle: connection.receiver.jobTitle ?? undefined,
            createdAt: connection.createdAt.toISOString(),
        },
    };
}
// ─── Accept connection request ─────────────────────────────────────────────
async function acceptConnection(connectionId, userId) {
    const connection = await prisma_1.default.connection.findUnique({
        where: { id: connectionId },
    });
    if (!connection)
        throw new Error("Connection not found");
    if (connection.receiverId !== userId) {
        throw new Error("Only the receiver can accept the request");
    }
    if (connection.status !== client_1.ConnectionStatus.PENDING) {
        throw new Error("Connection is not pending");
    }
    const updated = await prisma_1.default.connection.update({
        where: { id: connectionId },
        data: { status: client_1.ConnectionStatus.ACCEPTED },
        include: {
            requester: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    role: true,
                    company: true,
                    jobTitle: true,
                },
            },
            receiver: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    role: true,
                    company: true,
                    jobTitle: true,
                },
            },
        },
    });
    return {
        connection: {
            id: updated.id,
            connectionId: updated.id,
            status: "connected",
            requesterId: updated.requesterId,
            receiverId: updated.receiverId,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            requester: updated.requester,
            receiver: updated.receiver,
        },
    };
}
// ─── Reject connection request ─────────────────────────────────────────────
async function rejectConnection(connectionId, userId) {
    const connection = await prisma_1.default.connection.findUnique({
        where: { id: connectionId },
    });
    if (!connection)
        throw new Error("Connection not found");
    if (connection.receiverId !== userId) {
        throw new Error("Only the receiver can reject the request");
    }
    if (connection.status !== client_1.ConnectionStatus.PENDING) {
        throw new Error("Connection is not pending");
    }
    await prisma_1.default.connection.update({
        where: { id: connectionId },
        data: { status: client_1.ConnectionStatus.REJECTED },
    });
    return { success: true };
}
// ─── Delete / cancel connection ────────────────────────────────────────────
async function deleteConnection(connectionId, userId) {
    const connection = await prisma_1.default.connection.findUnique({
        where: { id: connectionId },
    });
    if (!connection)
        throw new Error("Connection not found");
    if (connection.requesterId !== userId && connection.receiverId !== userId) {
        throw new Error("You can only remove your own connections");
    }
    await prisma_1.default.connection.delete({
        where: { id: connectionId },
    });
    return { success: true };
}
