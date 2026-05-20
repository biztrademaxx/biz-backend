"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchSessionHandler = patchSessionHandler;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Accept youtube.com, youtu.be, with or without protocol/www, with optional query string
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/|youtu\.be\/)[^\s]*$/i;
function validateYoutubeUrls(urls) {
    if (!Array.isArray(urls))
        return false;
    return urls.every((u) => typeof u === "string" && YOUTUBE_REGEX.test(String(u).trim()));
}
async function patchSessionHandler(req, res) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        if (!auth?.sub) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        const body = req.body ?? {};
        const session = await prisma_1.default.speakerSession.findFirst({
            where: { id, speakerId: auth.sub },
            include: {
                event: { select: { id: true, title: true } },
                materials: true,
            },
        });
        if (!session) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        let youtubeUrls;
        if (body.youtube !== undefined) {
            if (!validateYoutubeUrls(body.youtube)) {
                return res.status(400).json({ error: "Invalid YouTube URL(s)" });
            }
            youtubeUrls = Array.isArray(body.youtube)
                ? body.youtube.map((u) => String(u).trim())
                : undefined;
        }
        const updated = await prisma_1.default.speakerSession.update({
            where: { id },
            data: {
                ...(youtubeUrls !== undefined && { youtube: youtubeUrls }),
                ...(body.title && { title: body.title }),
                ...(body.description && { description: body.description }),
                ...(body.abstract !== undefined && { abstract: body.abstract }),
                ...(body.learningObjectives !== undefined && { learningObjectives: body.learningObjectives }),
                ...(body.targetAudience !== undefined && { targetAudience: body.targetAudience }),
            },
            include: {
                event: { select: { id: true, title: true } },
                materials: true,
            },
        });
        return res.json({
            session: {
                id: updated.id,
                title: updated.title,
                description: updated.description,
                youtube: updated.youtube ?? [],
                event: updated.event,
                materials: (updated.materials ?? []).map((m) => ({
                    id: m.id,
                    fileName: m.fileName,
                    fileUrl: m.fileUrl,
                    fileSize: m.fileSize,
                    fileType: m.fileType,
                    mimeType: m.mimeType,
                    status: m.status,
                    allowDownload: m.allowDownload,
                    uploadedAt: m.uploadedAt.toISOString(),
                    downloadCount: m.downloadCount,
                    viewCount: m.viewCount,
                })),
            },
        });
    }
    catch (err) {
        console.error("Error updating session:", err);
        return res.status(500).json({ success: false, error: "Failed to update session" });
    }
}
router.patch("/sessions/:id", auth_middleware_1.requireUser, patchSessionHandler);
exports.default = router;
