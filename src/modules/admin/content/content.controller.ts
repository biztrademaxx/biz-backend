import { Request, Response } from "express";
import type { AdminContentType } from "@prisma/client";
import { sendError, sendList, sendOne } from "../../../lib/admin-response";
import * as service from "./content.service";

const TYPES: AdminContentType[] = ["NEWS", "BLOG", "BANNER", "FEATURED_EVENT", "MEDIA"];

function parseType(raw: string | undefined): AdminContentType | null {
  if (!raw) return null;
  const u = raw.toUpperCase() as AdminContentType;
  return TYPES.includes(u) ? u : null;
}

export async function listBanners(_req: Request, res: Response) {
  try {
    const data = await service.listBannersAdmin();
    return res.json({ success: true, data });
  } catch (e: any) {
    return sendError(res, 500, "Failed to list banners", e?.message);
  }
}

export async function createBanner(req: Request, res: Response) {
  try {
    const b = req.body ?? {};
    if (!b.title || !b.page || !b.imageUrl) {
      return sendError(res, 400, "title, page, and imageUrl are required");
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
  } catch (e: any) {
    return sendError(res, 500, "Failed to create banner", e?.message);
  }
}

export async function patchBanner(req: Request, res: Response) {
  try {
    const updated = await service.patchBanner(req.params.id, req.body ?? {});
    if (!updated) return sendError(res, 404, "Banner not found");
    return sendOne(res, updated);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update banner", e?.message);
  }
}

export async function deleteBanner(req: Request, res: Response) {
  try {
    const ok = await service.deleteBanner(req.params.id);
    if (!ok) return sendError(res, 404, "Banner not found");
    return res.json({ success: true });
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete banner", e?.message);
  }
}

export async function listItems(req: Request, res: Response) {
  try {
    const t = parseType(String(req.query.type ?? ""));
    if (!t) return sendError(res, 400, "Invalid or missing type query");
    const items = await service.listByType(t);
    return sendList(res, items, { page: 1, limit: items.length || 1, total: items.length, totalPages: 1 });
  } catch (e: any) {
    return sendError(res, 500, "Failed to list content", e?.message);
  }
}

export async function createItem(req: Request, res: Response) {
  try {
    const b = req.body ?? {};
    const t = parseType(String(b.type ?? ""));
    if (!t) return sendError(res, 400, "Invalid type");
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
  } catch (e: any) {
    return sendError(res, 500, "Failed to create content", e?.message);
  }
}

export async function patchItem(req: Request, res: Response) {
  try {
    const b = req.body ?? {};
    const updated = await service.patchContentItem(req.params.id, b);
    if (!updated) return sendError(res, 404, "Item not found");
    return sendOne(res, updated);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update content", e?.message);
  }
}

export async function deleteItem(req: Request, res: Response) {
  try {
    const ok = await service.deleteContentItem(req.params.id);
    if (!ok) return sendError(res, 404, "Item not found");
    return res.json({ success: true });
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete content", e?.message);
  }
}
