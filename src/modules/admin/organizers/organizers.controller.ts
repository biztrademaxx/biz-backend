import { Request, Response } from "express";
import { sendList, sendOne, sendError } from "../../../lib/admin-response";
import * as service from "./organizers.service";
import * as promoAdmin from "../promotions/promotions-admin.service";
import prisma from "../../../config/prisma";
import { importOrganizersFromFile } from "../bulk-import/bulk-import.service";
import { recordAdminActivity } from "../../../services/admin-activity-log.service";

export async function list(req: Request, res: Response) {
  try {
    const result = await service.listOrganizers(req.query as Record<string, unknown>);
    return sendList(res, result.data, result.pagination);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list organizers", e?.message);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const item = await service.getOrganizerById(req.params.id);
    if (!item) return sendError(res, 404, "Organizer not found");
    return sendOne(res, item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get organizer", e?.message);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const item = await service.createOrganizer(req.body ?? {});
    if (req.auth?.domain === "ADMIN") {
      await prisma.adminLog.create({
        data: {
          adminId: req.auth.sub,
          adminType: req.auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
          action: "ADMIN_ORGANIZER_CREATED",
          resource: "ORGANIZER",
          resourceId: (item as any)?.id ?? null,
          details: {
            email: (item as any)?.email ?? null,
            name: `${(item as any)?.firstName ?? ""} ${(item as any)?.lastName ?? ""}`.trim(),
          },
        },
      });
    }
    return res.status(201).json({ success: true, data: item });
  } catch (e: any) {
    if (e?.message?.includes("already exists")) return sendError(res, 400, e.message);
    return sendError(res, 500, "Failed to create organizer", e?.message);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await service.updateOrganizer(req.params.id, req.body ?? {});
    if (!item) return sendError(res, 404, "Organizer not found");
    await recordAdminActivity(req.auth, {
      action: "ADMIN_ORGANIZER_UPDATED",
      resource: "ORGANIZER",
      resourceId: (item as { id?: string }).id ?? req.params.id,
      details: {
        email: (item as { email?: string }).email ?? null,
        organizationName: (item as { organizationName?: string }).organizationName ?? null,
      },
    });
    return sendOne(res, item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update organizer", e?.message);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const result = await service.deleteOrganizer(req.params.id);
    if (!result) return sendError(res, 404, "Organizer not found");
    return sendOne(res, result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete organizer", e?.message);
  }
}

export async function listOrganizerConnections(req: Request, res: Response) {
  try {
    const items = await service.listOrganizerConnectionsForAdmin();
    // Frontend expects a plain array
    return res.json(items);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list organizer connections", e?.message);
  }
}

export async function getOrganizerConnectionsDetail(req: Request, res: Response) {
  try {
    const detail = await service.getOrganizerConnectionsDetailForAdmin(req.params.id);
    if (!detail) return sendError(res, 404, "Organizer not found");
    return res.json(detail);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get organizer connections detail", e?.message);
  }
}

export async function listVenueBookings(req: Request, res: Response) {
  try {
    const items = await service.listVenueBookingsForAdmin();
    return res.json({ data: items });
  } catch (e: any) {
    return sendError(res, 500, "Failed to list venue bookings", e?.message);
  }
}

export async function listOrganizerPromotions(_req: Request, res: Response) {
  try {
    const result = await promoAdmin.listOrganizerPromotionsAdmin();
    return res.json(result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to fetch promotions", e?.message);
  }
}

export async function getOrganizerPromotionById(req: Request, res: Response) {
  try {
    const promotion = await promoAdmin.getOrganizerPromotionAdmin(req.params.id);
    if (!promotion) return sendError(res, 404, "Promotion not found");
    return res.json({ promotion });
  } catch (e: any) {
    return sendError(res, 500, "Failed to fetch promotion", e?.message);
  }
}

export async function patchOrganizerPromotion(req: Request, res: Response) {
  try {
    const updated = await promoAdmin.patchOrganizerPromotionAdmin(req.params.id, req.body ?? {});
    if (!updated) return sendError(res, 404, "Promotion not found");
    return res.json({
      success: true,
      promotion: updated,
      message: `Promotion ${updated.status.toLowerCase()} successfully`,
    });
  } catch (e: any) {
    if (e?.message === "INVALID_STATUS") return sendError(res, 400, "Invalid status value");
    if (e?.message === "REJECTION_REASON_REQUIRED") {
      return sendError(res, 400, "Rejection reason is required");
    }
    return sendError(res, 500, "Failed to update promotion", e?.message);
  }
}

export async function importBulk(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth || auth.domain !== "ADMIN") {
      return sendError(res, 403, "Admin access required");
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file?.buffer) {
      return sendError(res, 400, "No file uploaded (use field name: file)");
    }

    const result = await importOrganizersFromFile({
      buffer: file.buffer,
      adminId: auth.sub,
      adminType: auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
    });

    const parts: string[] = [];
    if (result.createdCount > 0) parts.push(`${result.createdCount} created`);
    if (result.updatedCount > 0) parts.push(`${result.updatedCount} updated`);
    const summary = parts.length > 0 ? parts.join(", ") : "0 rows applied";

    return res.status(200).json({
      success: true,
      ...result,
      message: `${summary} (${result.errorCount} error(s)). Re-uploading the same file updates country, state, and city by email.`,
    });
  } catch (e: any) {
    return sendError(res, 500, "Failed to import organizers", e?.message);
  }
}

export async function sendAccountEmail(req: Request, res: Response) {
  try {
    await service.sendOrganizerAccountEmail({
      organizerId: req.body?.organizerId,
      organizerEmail: req.body?.organizerEmail,
    });
    return res.status(200).json({ success: true, message: "Organizer email sent successfully" });
  } catch (e: any) {
    if (e?.message?.includes("required")) return sendError(res, 400, e.message);
    if (e?.message?.includes("not found")) return sendError(res, 404, e.message);
    return sendError(res, 500, "Failed to send organizer email", e?.message);
  }
}
