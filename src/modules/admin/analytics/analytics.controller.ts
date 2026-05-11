import { Request, Response } from "express";
import { sendOne, sendError } from "../../../lib/admin-response";
import * as service from "./analytics.service";

export async function eventsGrowth(req: Request, res: Response) {
  try {
    const data = await service.getEventsGrowth();
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get events growth", e?.message);
  }
}

export async function userGrowth(req: Request, res: Response) {
  try {
    const data = await service.getUserGrowth();
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get user growth", e?.message);
  }
}

export async function revenue(req: Request, res: Response) {
  try {
    const data = await service.getRevenue();
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get revenue", e?.message);
  }
}

export async function subAdminActivity(req: Request, res: Response) {
  try {
    const data = await service.getSubAdminActivityAnalytics({});
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get sub-admin activity analytics", e?.message);
  }
}

export async function subAdminActivityById(req: Request, res: Response) {
  try {
    const adminId = String(req.params.adminId ?? "").trim();
    if (!adminId) return sendError(res, 400, "Missing adminId");
    const data = await service.getSubAdminActivityAnalytics({ adminId });
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get sub-admin detail analytics", e?.message);
  }
}

export async function myActivity(req: Request, res: Response) {
  try {
    const adminId = req.auth?.sub;
    if (!adminId) return sendError(res, 401, "Unauthorized");
    const data = await service.getSubAdminActivityAnalytics({ adminId });
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get my activity analytics", e?.message);
  }
}
