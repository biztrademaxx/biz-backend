"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectionsHandler = getConnectionsHandler;
exports.getConnectionRequestsHandler = getConnectionRequestsHandler;
exports.requestConnectionHandler = requestConnectionHandler;
exports.acceptConnectionHandler = acceptConnectionHandler;
exports.rejectConnectionHandler = rejectConnectionHandler;
exports.deleteConnectionHandler = deleteConnectionHandler;
const connections_service_1 = require("./connections.service");
async function getConnectionsHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const connections = await (0, connections_service_1.listConnections)(userId);
        return res.json({ connections, data: connections });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error listing connections:", error);
        return res.status(500).json({
            error: "Failed to fetch connections",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function getConnectionRequestsHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const requests = await (0, connections_service_1.listConnectionRequests)(userId);
        return res.json({ connections: requests, data: requests });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error listing connection requests:", error);
        return res.status(500).json({
            error: "Failed to fetch connection requests",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function requestConnectionHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { receiverId } = req.body;
        if (!receiverId) {
            return res.status(400).json({ error: "receiverId is required" });
        }
        const result = await (0, connections_service_1.requestConnection)(userId, receiverId);
        return res.status(201).json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("Error sending connection request:", error);
        if (message.includes("not found")) {
            return res.status(404).json({ error: message });
        }
        if (message.includes("already") ||
            message.includes("Cannot send") ||
            message.includes("yourself")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
async function acceptConnectionHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "Connection id is required" });
        }
        const result = await (0, connections_service_1.acceptConnection)(id, userId);
        return res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("Error accepting connection:", error);
        if (message.includes("not found")) {
            return res.status(404).json({ error: message });
        }
        if (message.includes("Only the receiver") || message.includes("not pending")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
async function rejectConnectionHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "Connection id is required" });
        }
        await (0, connections_service_1.rejectConnection)(id, userId);
        return res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("Error rejecting connection:", error);
        if (message.includes("not found")) {
            return res.status(404).json({ error: message });
        }
        if (message.includes("Only the receiver") || message.includes("not pending")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
async function deleteConnectionHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "Connection id is required" });
        }
        await (0, connections_service_1.deleteConnection)(id, userId);
        return res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("Error deleting connection:", error);
        if (message.includes("not found")) {
            return res.status(404).json({ error: message });
        }
        if (message.includes("only remove")) {
            return res.status(403).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
