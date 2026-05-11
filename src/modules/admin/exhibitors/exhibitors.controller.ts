import { Request, Response } from "express";
import { sendList, sendOne, sendError } from "../../../lib/admin-response";
import * as service from "./exhibitors.service";
import { updateEventAppointment } from "../../appointments/appointments.service";
import * as promoAdmin from "../promotions/promotions-admin.service";
import prisma from "../../../config/prisma";

export async function list(req: Request, res: Response) {
  try {
    const result = await service.listExhibitors(req.query as Record<string, unknown>);
    return sendList(res, result.data, result.pagination);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list exhibitors", e?.message);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const item = await service.getExhibitorById(req.params.id);
    if (!item) return sendError(res, 404, "Exhibitor not found");
    return sendOne(res, item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get exhibitor", e?.message);
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const stats = await service.getExhibitorStats();
    return res.json({ success: true, data: stats });
  } catch (e: any) {
    return sendError(res, 500, "Failed to get exhibitor stats", e?.message);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const item = await service.createExhibitor(req.body ?? {});
    if (req.auth?.domain === "ADMIN") {
      await prisma.adminLog.create({
        data: {
          adminId: req.auth.sub,
          adminType: req.auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
          action: "ADMIN_EXHIBITOR_CREATED",
          resource: "EXHIBITOR",
          resourceId: (item as any)?.id ?? null,
          details: {
            email: (item as any)?.email ?? null,
            company: (item as any)?.company ?? null,
          },
        },
      });
    }
    return res.status(201).json({ success: true, data: item });
  } catch (e: any) {
    if (e?.message?.includes("already exists")) return sendError(res, 400, e.message);
    return sendError(res, 500, "Failed to create exhibitor", e?.message);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await service.updateExhibitor(req.params.id, req.body ?? {});
    if (!item) return sendError(res, 404, "Exhibitor not found");
    return sendOne(res, item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update exhibitor", e?.message);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const result = await service.deleteExhibitor(req.params.id);
    if (!result) return sendError(res, 404, "Exhibitor not found");
    return sendOne(res, result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete exhibitor", e?.message);
  }
}

export async function listExhibitorFeedback(req: Request, res: Response) {
  try {
    const items = await service.listExhibitorFeedbackForAdmin();
    return res.json(items);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list exhibitor feedback", e?.message);
  }
}

export async function updateExhibitorFeedback(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action } = req.body ?? {};
    if (!id) return sendError(res, 400, "Review id required");
    // Optional: persist approval state if Review gets isApproved/isPublic later
    return res.json({ success: true, id, action: action ?? "approved" });
  } catch (e: any) {
    return sendError(res, 500, "Failed to update feedback", e?.message);
  }
}

export async function listExhibitorAppointments(req: Request, res: Response) {
  try {
    const appointments = await service.listExhibitorAppointmentsForAdmin();
    return res.json({ appointments });
  } catch (e: any) {
    return sendError(res, 500, "Failed to list exhibitor appointments", e?.message);
  }
}

export async function updateExhibitorAppointmentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, cancelReason } = req.body ?? {};
    if (!id) return sendError(res, 400, "Appointment id required");
    const result = await updateEventAppointment({
      appointmentId: id,
      status,
      cancellationReason: cancelReason,
    });
    return res.json({ success: true, appointment: result.appointment });
  } catch (e: any) {
    if (e?.message?.includes("not found")) return sendError(res, 404, e.message);
    return sendError(res, 500, "Failed to update appointment", e?.message);
  }
}

export async function listExhibitorPromotions(_req: Request, res: Response) {
  try {
    const promotions = await promoAdmin.listExhibitorPromotionsAdmin();
    return res.json(promotions);
  } catch (e: any) {
    return sendError(res, 500, "Failed to fetch exhibitor promotions", e?.message);
  }
}

export async function getExhibitorPromotionById(req: Request, res: Response) {
  try {
    const promotion = await promoAdmin.getExhibitorPromotionAdmin(req.params.id);
    if (!promotion) return sendError(res, 404, "Promotion not found");
    return res.json(promotion);
  } catch (e: any) {
    return sendError(res, 500, "Failed to fetch promotion", e?.message);
  }
}

export async function patchExhibitorPromotion(req: Request, res: Response) {
  try {
    const updated = await promoAdmin.patchExhibitorPromotionAdmin(req.params.id, req.body ?? {});
    if (!updated) return sendError(res, 404, "Promotion not found");
    return res.json(updated);
  } catch (e: any) {
    if (e?.message === "INVALID_STATUS") return sendError(res, 400, "Invalid status");
    if (e?.message === "REJECTION_REASON_REQUIRED") {
      return sendError(res, 400, "Rejection reason is required");
    }
    return sendError(res, 500, "Failed to update promotion", e?.message);
  }
}
