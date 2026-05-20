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
exports.listBanners = listBanners;
exports.createBanner = createBanner;
exports.patchBanner = patchBanner;
exports.deleteBanner = deleteBanner;
exports.listItems = listItems;
exports.createItem = createItem;
exports.patchItem = patchItem;
exports.deleteItem = deleteItem;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./content.service"));
const TYPES = ["NEWS", "BLOG", "BANNER", "FEATURED_EVENT", "MEDIA"];
function parseType(raw) {
    if (!raw)
        return null;
    const u = raw.toUpperCase();
    return TYPES.includes(u) ? u : null;
}
async function listBanners(_req, res) {
    try {
        const data = await service.listBannersAdmin();
        return res.json({ success: true, data });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list banners", e?.message);
    }
}
async function createBanner(req, res) {
    try {
        const b = req.body ?? {};
        if (!b.title || !b.page || !b.imageUrl) {
            return (0, admin_response_1.sendError)(res, 400, "title, page, and imageUrl are required");
        }
        const created = await service.createBanner({
            title: String(b.title),
            description: typeof b.description === "string" ? b.description : undefined,
            page: String(b.page),
            position: String(b.position ?? "hero"),
            imageUrl: String(b.imageUrl),
            publicId: b.publicId ? String(b.publicId) : undefined,
            width: b.width != null ? Number(b.width) : undefined,
            height: b.height != null ? Number(b.height) : undefined,
            isActive: b.isActive !== false,
            link: typeof b.link === "string" && b.link.trim() ? String(b.link).trim() : undefined,
        });
        return res.status(201).json({ success: true, data: created });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to create banner", e?.message);
    }
}
async function patchBanner(req, res) {
    try {
        const updated = await service.patchBanner(req.params.id, req.body ?? {});
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Banner not found");
        return (0, admin_response_1.sendOne)(res, updated);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update banner", e?.message);
    }
}
async function deleteBanner(req, res) {
    try {
        const ok = await service.deleteBanner(req.params.id);
        if (!ok)
            return (0, admin_response_1.sendError)(res, 404, "Banner not found");
        return res.json({ success: true });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete banner", e?.message);
    }
}
async function listItems(req, res) {
    try {
        const t = parseType(String(req.query.type ?? ""));
        if (!t)
            return (0, admin_response_1.sendError)(res, 400, "Invalid or missing type query");
        const items = await service.listByType(t);
        return (0, admin_response_1.sendList)(res, items, { page: 1, limit: items.length || 1, total: items.length, totalPages: 1 });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to list content", e?.message);
    }
}
async function createItem(req, res) {
    try {
        const b = req.body ?? {};
        const t = parseType(String(b.type ?? ""));
        if (!t)
            return (0, admin_response_1.sendError)(res, 400, "Invalid type");
        const created = await service.createContentItem({
            type: t,
            title: b.title,
            slug: b.slug,
            body: b.body,
            extras: b.extras,
            published: b.published,
            sortOrder: b.sortOrder != null ? Number(b.sortOrder) : undefined,
        });
        return res.status(201).json({ success: true, data: created });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to create content", e?.message);
    }
}
async function patchItem(req, res) {
    try {
        const b = req.body ?? {};
        const updated = await service.patchContentItem(req.params.id, b);
        if (!updated)
            return (0, admin_response_1.sendError)(res, 404, "Item not found");
        return (0, admin_response_1.sendOne)(res, updated);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update content", e?.message);
    }
}
async function deleteItem(req, res) {
    try {
        const ok = await service.deleteContentItem(req.params.id);
        if (!ok)
            return (0, admin_response_1.sendError)(res, 404, "Item not found");
        return res.json({ success: true });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete content", e?.message);
    }
}
