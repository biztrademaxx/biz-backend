"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventNetworkHandler = getEventNetworkHandler;
const network_service_1 = require("./network.service");
async function getEventNetworkHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { eventId } = req.params;
        if (!eventId) {
            return res.status(400).json({ error: "eventId is required" });
        }
        const result = await (0, network_service_1.getEventNetwork)(eventId, userId);
        return res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("Error fetching event network:", error);
        if (message.includes("not found")) {
            return res.status(404).json({ error: message });
        }
        return res.status(500).json({
            error: "Failed to fetch event network",
            details: message,
        });
    }
}
