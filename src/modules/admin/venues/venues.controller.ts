import { Request, Response } from "express";
import { sendList, sendOne, sendError } from "../../../lib/admin-response";
import * as service from "./venues.service";
import { importVenuesFromFile } from "../bulk-import/bulk-import.service";

export async function list(req: Request, res: Response) {
  try {
    const result = await service.listVenues(req.query as Record<string, unknown>);
    return sendList(res, result.data, result.pagination);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list venues", e?.message);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const item = await service.getVenueById(req.params.id);
    if (!item) return sendError(res, 404, "Venue not found");
    return sendOne(res, item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get venue", e?.message);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const item = await service.createVenue(req.body ?? {});
    return res.status(201).json({ success: true, data: item });
  } catch (e: any) {
    if (e?.message?.includes("already exists")) return sendError(res, 400, e.message);
    return sendError(res, 500, "Failed to create venue", e?.message);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await service.updateVenue(req.params.id, req.body ?? {});
    if (!item) return sendError(res, 404, "Venue not found");
    return sendOne(res, item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update venue", e?.message);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const result = await service.deleteVenue(req.params.id);
    if (!result) return sendError(res, 404, "Venue not found");
    return sendOne(res, result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete venue", e?.message);
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

    const result = await importVenuesFromFile({
      buffer: file.buffer,
      adminId: auth.sub,
      adminType: auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
    });

    return res.status(200).json({
      success: true,
      ...result,
      message: `Imported ${result.successCount} venue(s) with ${result.errorCount} error(s).`,
    });
  } catch (e: any) {
    return sendError(res, 500, "Failed to import venues", e?.message);
  }
}

export async function sendAccountEmail(req: Request, res: Response) {
  try {
    await service.sendVenueAccountEmail({
      venueId: req.body?.venueId,
      venueEmail: req.body?.venueEmail,
    });
    return res.status(200).json({ success: true, message: "Venue manager email sent successfully" });
  } catch (e: any) {
    if (e?.message?.includes("required")) return sendError(res, 400, e.message);
    if (e?.message?.includes("not found")) return sendError(res, 404, e.message);
    return sendError(res, 500, "Failed to send venue email", e?.message);
  }
}
