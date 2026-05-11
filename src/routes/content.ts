import { Request, Response, Router } from "express";
import * as contentService from "../modules/admin/content/content.service";

const router = Router();

/**
 * GET /api/content/banners
 * Public: published banners only. Query: page, position (optional).
 */
router.get("/content/banners", async (req: Request, res: Response) => {
  try {
    const page = typeof req.query.page === "string" ? req.query.page : undefined;
    const position = typeof req.query.position === "string" ? req.query.position : undefined;
    const list = await contentService.listBannersPublic({ page, position });
    res.json(list);
  } catch (e) {
    console.error("content/banners", e);
    res.status(500).json({ error: "Failed to load banners" });
  }
});

/** Legacy POST — use POST /api/admin/upload + POST /api/admin/content/banners instead. */
router.post("/content/banners", (_req: Request, res: Response) => {
  res.status(400).json({
    error: "Use admin upload: POST /api/admin/upload then POST /api/admin/content/banners with imageUrl/publicId.",
  });
});

/**
 * GET /api/content/blog
 * Public: published blog posts (for marketing site listing).
 */
router.get("/content/blog", async (_req: Request, res: Response) => {
  try {
    const data = await contentService.listPublishedBlogs();
    res.json({ success: true, data });
  } catch (e) {
    console.error("content/blog", e);
    res.status(500).json({ success: false, error: "Failed to load blog posts" });
  }
});

/**
 * GET /api/content/blog/:slug
 * Public: single published post by slug.
 */
router.get("/content/blog/:slug", async (req: Request, res: Response) => {
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
  } catch (e) {
    console.error("content/blog/:slug", e);
    res.status(500).json({ success: false, error: "Failed to load blog post" });
  }
});

export default router;
