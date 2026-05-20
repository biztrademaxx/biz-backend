"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postMaterialHandler = postMaterialHandler;
exports.patchMaterialHandler = patchMaterialHandler;
exports.getMaterialDownloadHandler = getMaterialDownloadHandler;
exports.deleteMaterialHandler = deleteMaterialHandler;
exports.postMaterialViewHandler = postMaterialViewHandler;
const materials_service_1 = require("./materials.service");
async function postMaterialHandler(req, res) {
    try {
        const file = req.file;
        const sessionId = req.body?.sessionId?.trim();
        const speakerId = req.body?.speakerId?.trim();
        const auth = req.auth;
        if (!auth?.sub) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        if (auth.sub !== speakerId) {
            return res.status(403).json({ success: false, error: "Forbidden" });
        }
        if (!file) {
            return res.status(400).json({ success: false, error: "File is required" });
        }
        if (!sessionId || !speakerId) {
            return res.status(400).json({ success: false, error: "sessionId and speakerId are required" });
        }
        const allowDownload = req.body?.allowDownload === "true" || req.body?.allowDownload === true;
        const description = req.body?.description;
        const status = req.body?.status || "DRAFT";
        const result = await (0, materials_service_1.createMaterial)(file, sessionId, speakerId, {
            allowDownload,
            description,
            status,
        });
        return res.status(201).json(result);
    }
    catch (err) {
        if (err?.message === "Session not found or you are not the speaker") {
            return res.status(404).json({ success: false, error: err.message });
        }
        if (err?.message === "UNSUPPORTED_MATERIAL_TYPE" || err?.message === "MATERIAL_TOO_LARGE") {
            return res.status(400).json({ success: false, error: err.message });
        }
        console.error("Error creating material:", err);
        return res.status(500).json({ success: false, error: "Failed to upload material" });
    }
}
async function patchMaterialHandler(req, res) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        if (!auth?.sub) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        const body = req.body ?? {};
        const result = await (0, materials_service_1.updateMaterial)(id, auth.sub, {
            allowDownload: body.allowDownload,
            status: body.status,
            description: body.description,
        });
        return res.json(result);
    }
    catch (err) {
        if (err?.message === "Material not found or access denied") {
            return res.status(404).json({ success: false, error: err.message });
        }
        console.error("Error updating material:", err);
        return res.status(500).json({ success: false, error: "Failed to update material" });
    }
}
async function getMaterialDownloadHandler(req, res) {
    try {
        const { id } = req.params;
        const material = await (0, materials_service_1.getMaterialForDownload)(id);
        if (!material) {
            return res.status(404).json({ success: false, error: "Material not found" });
        }
        return res.json({ fileUrl: material.fileUrl });
    }
    catch (err) {
        console.error("Error getting material download:", err);
        return res.status(500).json({ success: false, error: "Failed to get download URL" });
    }
}
async function deleteMaterialHandler(req, res) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        if (!auth?.sub) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        await (0, materials_service_1.deleteMaterialById)(id, auth.sub);
        return res.json({ success: true, message: "Material deleted successfully" });
    }
    catch (err) {
        if (err?.message === "Material not found or access denied") {
            return res.status(404).json({ success: false, error: err.message });
        }
        console.error("Error deleting material:", err);
        return res.status(500).json({ success: false, error: "Failed to delete material" });
    }
}
async function postMaterialViewHandler(req, res) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        if (!auth?.sub) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        await (0, materials_service_1.recordMaterialView)(id, auth.sub);
        return res.json({ success: true });
    }
    catch (err) {
        console.error("Error recording material view:", err);
        return res.status(500).json({ success: false, error: "Failed to record view" });
    }
}
