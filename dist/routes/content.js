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
const express_1 = require("express");
const contentService = __importStar(require("../modules/admin/content/content.service"));
const router = (0, express_1.Router)();
/**
 * GET /api/content/banners
 * Public: published banners only. Query: page, position (optional).
 */
router.get("/content/banners", async (req, res) => {
    try {
        const page = typeof req.query.page === "string" ? req.query.page : undefined;
        const position = typeof req.query.position === "string" ? req.query.position : undefined;
        const list = await contentService.listBannersPublic({ page, position });
        res.json(list);
    }
    catch (e) {
        console.error("content/banners", e);
        res.status(500).json({ error: "Failed to load banners" });
    }
});
/** Legacy POST — use POST /api/admin/upload + POST /api/admin/content/banners instead. */
router.post("/content/banners", (_req, res) => {
    res.status(400).json({
        error: "Use admin upload: POST /api/admin/upload then POST /api/admin/content/banners with imageUrl/publicId.",
    });
});
/**
 * GET /api/content/blog
 * Public: published blog posts (for marketing site listing).
 */
router.get("/content/blog", async (_req, res) => {
    try {
        const data = await contentService.listPublishedBlogs();
        res.json({ success: true, data });
    }
    catch (e) {
        console.error("content/blog", e);
        res.status(500).json({ success: false, error: "Failed to load blog posts" });
    }
});
/**
 * GET /api/content/blog/:slug
 * Public: single published post by slug.
 */
router.get("/content/blog/:slug", async (req, res) => {
    try {
        const slug = String(req.params.slug ?? "").trim();
        if (!slug) {
            res.status(400).json({ success: false, error: "Missing slug" });
            return;
        }
        const post = await contentService.getPublishedBlogBySlug(slug);
        if (!post) {
            res.status(404).json({ success: false, error: "Not found" });
            return;
        }
        res.json({ success: true, data: post });
    }
    catch (e) {
        console.error("content/blog/:slug", e);
        res.status(500).json({ success: false, error: "Failed to load blog post" });
    }
});
exports.default = router;
