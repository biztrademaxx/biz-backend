"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConversations = listConversations;
exports.getConversationById = getConversationById;
exports.startConversation = startConversation;
const prisma_1 = __importDefault(require("../../config/prisma"));
const client_1 = require("@prisma/client");
// ─── List conversations for the current user (uses ConversationSummary) ─────
async function listConversations(userId) {
    const summaries = await prisma_1.default.conversationSummary.findMany({
        where: { userId },
        include: {
            conversation: {
                include: {
                    participants: {
                        include: {
                            user: {
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
                    },
                },
            },
        },
        orderBy: { lastMessageAt: "desc" },
    });
    return summaries.map((s) => {
        const conv = s.conversation;
        const otherParticipants = conv.participants.filter((x) => x.userId !== userId);
        return {
            id: conv.id,
            contactId: otherParticipants[0]?.userId ?? conv.id,
            lastMessage: s.lastMessage ?? "",
            lastMessageTime: s.lastMessageAt?.toISOString() ?? conv.updatedAt.toISOString(),
            unreadCount: s.unreadCount ?? 0,
            contact: otherParticipants[0]?.user,
        };
    });
}
// ─── Get a single conversation by id (must be participant) ──────────────────
async function getConversationById(conversationId, userId) {
    const participant = await prisma_1.default.conversationParticipant.findFirst({
        where: {
            conversationId,
            userId,
        },
        include: {
            conversation: {
                include: {
                    participants: {
                        include: {
                            user: {
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
                    },
                },
            },
        },
    });
    if (!participant) {
        return null;
    }
    const conv = participant.conversation;
    const others = conv.participants.filter((p) => p.userId !== userId).map((p) => p.user);
    return {
        id: conv.id,
        participants: conv.participants.map((p) => ({
            userId: p.userId,
            lastReadAt: p.lastReadAt?.toISOString() ?? null,
            user: p.user,
        })),
        otherUsers: others,
    };
}
// ─── Start a conversation (with one or more other users); must be connected ───
async function startConversation(userId, participantUserIds) {
    const uniqueIds = [...new Set(participantUserIds)];
    if (uniqueIds.length === 0) {
        throw new Error("At least one participant is required");
    }
    if (uniqueIds.includes(userId)) {
        throw new Error("Cannot include yourself in participant list");
    }
    // For 1:1, check that users are connected (optional business rule)
    if (uniqueIds.length === 1) {
        const otherId = uniqueIds[0];
        const connection = await prisma_1.default.connection.findFirst({
            where: {
                status: client_1.ConnectionStatus.ACCEPTED,
                OR: [
                    { requesterId: userId, receiverId: otherId },
                    { requesterId: otherId, receiverId: userId },
                ],
            },
        });
        if (!connection) {
            throw new Error("You must be connected with this user to start a conversation");
        }
    }
    // Check if a 1:1 conversation already exists between userId and the other user
    if (uniqueIds.length === 1) {
        const otherId = uniqueIds[0];
        const myParticipations = await prisma_1.default.conversationParticipant.findMany({
            where: { userId },
            include: {
                conversation: {
                    include: { participants: { select: { userId: true } } },
                },
            },
        });
        for (const p of myParticipations) {
            const participantIds = p.conversation.participants.map((x) => x.userId);
            if (participantIds.length === 2 &&
                participantIds.includes(userId) &&
                participantIds.includes(otherId)) {
                const convId = p.conversation.id;
                await prisma_1.default.conversationSummary.upsert({
                    where: { conversationId_userId: { conversationId: convId, userId } },
                    create: { conversationId: convId, userId, lastMessage: "", unreadCount: 0 },
                    update: {},
                });
                await prisma_1.default.conversationSummary.upsert({
                    where: { conversationId_userId: { conversationId: convId, userId: otherId } },
                    create: { conversationId: convId, userId: otherId, lastMessage: "", unreadCount: 0 },
                    update: {},
                });
                return {
                    conversation: {
                        id: convId,
                        createdAt: p.conversation.createdAt.toISOString(),
                    },
                };
            }
        }
    }
    const allUserIds = [userId, ...uniqueIds];
    const users = await prisma_1.default.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true },
    });
    if (users.length !== allUserIds.length) {
        throw new Error("One or more participants not found");
    }
    const conversation = await prisma_1.default.conversation.create({
        data: {
            participants: {
                create: allUserIds.map((uid) => ({
                    userId: uid,
                })),
            },
            summaries: {
                create: allUserIds.map((uid) => ({
                    userId: uid,
                    lastMessage: "",
                    unreadCount: 0,
                })),
            },
        },
        include: {
            participants: {
                include: {
                    user: {
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
            },
        },
    });
    return {
        conversation: {
            id: conversation.id,
            createdAt: conversation.createdAt.toISOString(),
            participants: conversation.participants.map((p) => ({
                userId: p.userId,
                user: p.user,
            })),
        },
    };
}
