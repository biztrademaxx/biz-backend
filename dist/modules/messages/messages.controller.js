"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagesHandler = getMessagesHandler;
exports.postMessageHandler = postMessageHandler;
exports.markReadHandler = markReadHandler;
const client_1 = require("@prisma/client");
const messages_service_1 = require("./messages.service");
async function getMessagesHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { conversationId } = req.params;
        if (!conversationId) {
            return res.status(400).json({ error: "conversationId is required" });
        }
        const messages = await (0, messages_service_1.listMessages)(conversationId, userId);
        if (messages === null) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        return res.json({ messages });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error listing messages:", error);
        return res.status(500).json({
            error: "Failed to fetch messages",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function postMessageHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { conversationId, content, type } = req.body;
        if (!conversationId || !content) {
            return res.status(400).json({ error: "conversationId and content are required" });
        }
        const result = await (0, messages_service_1.sendMessage)({
            senderId: userId,
            conversationId,
            content,
            type: type === "SYSTEM" ? client_1.MessageType.SYSTEM : client_1.MessageType.TEXT,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("Error sending message:", error);
        if (message.includes("not a participant")) {
            return res.status(403).json({ error: message });
        }
        if (message.includes("content is required")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
async function markReadHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { conversationId } = req.body;
        if (!conversationId) {
            return res.status(400).json({ error: "conversationId is required" });
        }
        await (0, messages_service_1.markConversationAsRead)(conversationId, userId);
        return res.json({ success: true });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error marking messages as read:", error);
        return res.status(500).json({
            error: "Failed to mark as read",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
