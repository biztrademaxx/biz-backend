"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConferencesHandler = listConferencesHandler;
exports.getConferenceHandler = getConferenceHandler;
exports.createConferenceHandler = createConferenceHandler;
exports.updateConferenceHandler = updateConferenceHandler;
exports.deleteConferenceHandler = deleteConferenceHandler;
const conferences_service_1 = require("./conferences.service");
async function listConferencesHandler(req, res) {
    try {
        const eventId = req.query.eventId;
        if (!eventId) {
            return res.status(400).json({ error: "Event ID is required" });
        }
        const conferences = await (0, conferences_service_1.listConferencesByEvent)(eventId);
        return res.json(conferences);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error listing conferences:", err);
        return res.status(500).json({ error: "Failed to fetch conferences" });
    }
}
async function getConferenceHandler(req, res) {
    try {
        const id = req.params.id;
        const conference = await (0, conferences_service_1.getConferenceById)(id);
        if (!conference) {
            return res.status(404).json({ error: "Conference not found" });
        }
        return res.json(conference);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching conference:", err);
        return res.status(500).json({ error: "Failed to fetch conference" });
    }
}
async function createConferenceHandler(req, res) {
    try {
        const conference = await (0, conferences_service_1.createConference)(req.body ?? {});
        return res.status(201).json(conference);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error creating conference:", err);
        const message = err instanceof Error ? err.message : "Failed to create conference";
        if (message.includes("not found") || message.includes("Event not found")) {
            return res.status(404).json({ error: message });
        }
        if (message.includes("Missing required")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
async function updateConferenceHandler(req, res) {
    try {
        const id = req.params.id;
        const conference = await (0, conferences_service_1.updateConference)(id, req.body ?? {});
        return res.json(conference);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error updating conference:", err);
        const message = err instanceof Error ? err.message : "Failed to update conference";
        if (message.includes("not found") || message.includes("Conference not found")) {
            return res.status(404).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
async function deleteConferenceHandler(req, res) {
    try {
        const id = req.params.id;
        await (0, conferences_service_1.deleteConference)(id);
        return res.json({ message: "Conference deleted successfully" });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error deleting conference:", err);
        const message = err instanceof Error ? err.message : "Failed to delete conference";
        if (message.includes("not found") || message.includes("Conference not found")) {
            return res.status(404).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
