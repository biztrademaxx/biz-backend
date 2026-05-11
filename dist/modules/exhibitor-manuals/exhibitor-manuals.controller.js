"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByIdHandler = getByIdHandler;
exports.listHandler = listHandler;
exports.createHandler = createHandler;
exports.deleteHandler = deleteHandler;
exports.updateHandler = updateHandler;
const service = __importStar(require("./exhibitor-manuals.service"));
async function getByIdHandler(req, res) {
    try {
        const id = req.params.id;
        const doc = await service.getById(id);
        if (!doc)
            return res.status(404).json({ error: "Exhibitor manual not found" });
        return res.json({ success: true, data: doc });
    }
    catch (e) {
        console.error("Exhibitor manual get error:", e);
        return res.status(500).json({ error: e?.message ?? "Failed to get exhibitor manual" });
    }
}
async function listHandler(req, res) {
    try {
        const eventId = req.query.eventId;
        if (!eventId) {
            return res.status(400).json({ error: "eventId is required" });
        }
        const list = await service.listByEventId(eventId);
        return res.json({ success: true, data: list });
    }
    catch (e) {
        console.error("Exhibitor manuals list error:", e);
        return res.status(500).json({ error: e?.message ?? "Failed to list exhibitor manuals" });
    }
}
async function createHandler(req, res) {
    try {
        const doc = await service.create(req.body ?? {});
        return res.status(201).json({ success: true, data: doc });
    }
    catch (e) {
        if (e?.message === "Event not found" || e?.message === "User not found") {
            return res.status(404).json({ error: e.message });
        }
        if (e?.message?.includes("Missing required")) {
            return res.status(400).json({ error: e.message });
        }
        console.error("Exhibitor manual create error:", e);
        return res.status(500).json({ error: e?.message ?? "Failed to create exhibitor manual" });
    }
}
async function deleteHandler(req, res) {
    try {
        const id = req.params.id;
        await service.remove(id);
        return res.json({ success: true });
    }
    catch (e) {
        if (e?.message === "Exhibitor manual not found") {
            return res.status(404).json({ error: e.message });
        }
        console.error("Exhibitor manual delete error:", e);
        return res.status(500).json({ error: e?.message ?? "Failed to delete" });
    }
}
async function updateHandler(req, res) {
    try {
        const id = req.params.id;
        const doc = await service.update(id, req.body ?? {});
        return res.json({ success: true, data: doc });
    }
    catch (e) {
        if (e?.message === "Exhibitor manual not found") {
            return res.status(404).json({ error: e.message });
        }
        console.error("Exhibitor manual update error:", e);
        return res.status(500).json({ error: e?.message ?? "Failed to update" });
    }
}
