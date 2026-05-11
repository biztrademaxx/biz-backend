"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpeakersHandler = getSpeakersHandler;
exports.getSpeakerHandler = getSpeakerHandler;
exports.getSpeakerEventsHandler = getSpeakerEventsHandler;
exports.getSpeakerSessionsHandler = getSpeakerSessionsHandler;
exports.putSpeakerHandler = putSpeakerHandler;
exports.postSpeakerHandler = postSpeakerHandler;
const speakers_service_1 = require("./speakers.service");
async function getSpeakersHandler(req, res) {
    try {
        const requireProfileImage = req.query.requireProfileImage === "1" || req.query.requireProfileImage === "true";
        const speakers = await (0, speakers_service_1.listSpeakers)({ requireProfileImage });
        return res.json({
            success: true,
            speakers,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching speakers (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}
async function getSpeakerHandler(req, res) {
    try {
        const { id } = req.params;
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const profile = await (0, speakers_service_1.getSpeakerById)(id, viewerId);
        if (!profile) {
            return res.status(404).json({ success: false, error: "Speaker not found" });
        }
        return res.json({
            success: true,
            profile,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching speaker (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}
async function getSpeakerEventsHandler(req, res) {
    try {
        const { id } = req.params;
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const result = await (0, speakers_service_1.getSpeakerEvents)(id, viewerId);
        return res.json(result);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching speaker events (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}
async function getSpeakerSessionsHandler(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: "Speaker ID required" });
        }
        const sessions = await (0, speakers_service_1.getSpeakerSessions)(id);
        return res.json({ success: true, sessions });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching speaker sessions (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}
async function putSpeakerHandler(req, res) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        if (!auth || auth.sub !== id) {
            return res.status(403).json({ success: false, error: "Forbidden" });
        }
        const profile = await (0, speakers_service_1.updateSpeakerProfile)(id, req.body ?? {});
        if (!profile) {
            return res.status(404).json({ success: false, error: "Speaker not found" });
        }
        return res.json({
            success: true,
            profile,
            message: "Speaker updated successfully",
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error updating speaker (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}
async function postSpeakerHandler(req, res) {
    try {
        const speaker = await (0, speakers_service_1.createSpeaker)(req.body ?? {});
        return res.status(201).json({
            success: true,
            speaker,
            message: "Speaker created successfully",
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating speaker (backend):", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        if (msg.includes("already exists")) {
            return res.status(409).json({ success: false, error: msg });
        }
        if (msg.includes("required")) {
            return res.status(400).json({ success: false, error: msg });
        }
        return res.status(500).json({ success: false, error: msg });
    }
}
