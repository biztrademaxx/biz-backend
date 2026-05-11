"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConversationsHandler = listConversationsHandler;
exports.getConversationHandler = getConversationHandler;
exports.startConversationHandler = startConversationHandler;
const conversations_service_1 = require("./conversations.service");
async function listConversationsHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const list = await (0, conversations_service_1.listConversations)(userId);
        return res.json({ conversations: list });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error listing conversations:", error);
        return res.status(500).json({
            error: "Failed to fetch conversations",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function getConversationHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "Conversation id is required" });
        }
        const conversation = await (0, conversations_service_1.getConversationById)(id, userId);
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        return res.json({ conversation });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching conversation:", error);
        return res.status(500).json({
            error: "Failed to fetch conversation",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function startConversationHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { participantIds } = req.body;
        if (!Array.isArray(participantIds) || participantIds.length === 0) {
            return res.status(400).json({ error: "participantIds array with at least one user id is required" });
        }
        const result = await (0, conversations_service_1.startConversation)(userId, participantIds);
        return res.status(201).json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("Error starting conversation:", error);
        if (message.includes("not found") || message.includes("participants not found")) {
            return res.status(404).json({ error: message });
        }
        if (message.includes("connected") || message.includes("yourself") || message.includes("participant")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
