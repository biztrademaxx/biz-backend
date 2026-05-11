"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMessages = listMessages;
exports.sendMessage = sendMessage;
exports.markConversationAsRead = markConversationAsRead;
const prisma_1 = __importDefault(require("../../config/prisma"));
const client_1 = require("@prisma/client");
// ─── List messages in a conversation ────────────────────────────────────────
async function listMessages(conversationId, userId) {
    const participant = await prisma_1.default.conversationParticipant.findFirst({
        where: {
            conversationId,
            userId,
        },
    });
    if (!participant) {
        return null;
    }
    const messages = await prisma_1.default.message.findMany({
        where: { conversationId },
        include: {
            sender: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });
    return messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: undefined,
        conversationId: m.conversationId,
        content: m.content,
        type: m.type,
        isRead: m.isRead,
        createdAt: m.createdAt.toISOString(),
        sender: m.sender
            ? {
                id: m.sender.id,
                firstName: m.sender.firstName,
                lastName: m.sender.lastName,
                avatar: m.sender.avatar ?? undefined,
            }
            : undefined,
    }));
}
// ─── Send a message ──────────────────────────────────────────────────────────
async function sendMessage(params) {
    const { senderId, conversationId, content, type = client_1.MessageType.TEXT } = params;
    if (!content || !content.trim()) {
        throw new Error("Message content is required");
    }
    const participant = await prisma_1.default.conversationParticipant.findFirst({
        where: {
            conversationId,
            userId: senderId,
        },
    });
    if (!participant) {
        throw new Error("You are not a participant in this conversation");
    }
    const message = await prisma_1.default.message.create({
        data: {
            senderId,
            conversationId,
            content: content.trim(),
            type,
        },
        include: {
            sender: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                },
            },
        },
    });
    const contentPreview = content.trim().slice(0, 500);
    const now = message.createdAt;
    const participants = await prisma_1.default.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
    });
    for (const p of participants) {
        if (p.userId === senderId) {
            await prisma_1.default.conversationSummary.upsert({
                where: {
                    conversationId_userId: { conversationId, userId: p.userId },
                },
                create: {
                    conversationId,
                    userId: p.userId,
                    lastMessage: contentPreview,
                    lastMessageAt: now,
                    unreadCount: 0,
                },
                update: {
                    lastMessage: contentPreview,
                    lastMessageAt: now,
                },
            });
        }
        else {
            await prisma_1.default.conversationSummary.upsert({
                where: {
                    conversationId_userId: { conversationId, userId: p.userId },
                },
                create: {
                    conversationId,
                    userId: p.userId,
                    lastMessage: contentPreview,
                    lastMessageAt: now,
                    unreadCount: 1,
                },
                update: {
                    lastMessage: contentPreview,
                    lastMessageAt: now,
                    unreadCount: { increment: 1 },
                },
            });
        }
    }
    return {
        message: {
            id: message.id,
            senderId: message.senderId,
            conversationId: message.conversationId,
            content: message.content,
            type: message.type,
            isRead: message.isRead,
            createdAt: message.createdAt.toISOString(),
            sender: message.sender
                ? {
                    id: message.sender.id,
                    firstName: message.sender.firstName,
                    lastName: message.sender.lastName,
                    avatar: message.sender.avatar ?? undefined,
                }
                : undefined,
        },
    };
}
// ─── Mark messages in a conversation as read (for current user) ──────────────
async function markConversationAsRead(conversationId, userId) {
    await prisma_1.default.conversationParticipant.updateMany({
        where: {
            conversationId,
            userId,
        },
        data: {
            lastReadAt: new Date(),
        },
    });
    await prisma_1.default.message.updateMany({
        where: {
            conversationId,
            senderId: { not: userId },
        },
        data: { isRead: true },
    });
    await prisma_1.default.conversationSummary.updateMany({
        where: {
            conversationId,
            userId,
        },
        data: { unreadCount: 0 },
    });
    return { success: true };
}
