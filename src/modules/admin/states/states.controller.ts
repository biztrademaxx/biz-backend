import { Request, Response } from "express";
import { sendError } from "../../../lib/admin-response";
import * as service from "./states.service";

export async function list(req: Request, res: Response) {
  try {
    const includeCounts = req.query.includeCounts === "true";
    const countryCode = typeof req.query.countryCode === "string" ? req.query.countryCode : undefined;
    const data = await service.listStates(includeCounts, countryCode);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list states", e?.message);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    if (!body.name || !body.countryId) {
      return sendError(res, 400, "name and countryId are required");
    }
    const item = await service.createState({
      name: body.name,
      countryId: body.countryId,
      isActive: body.isActive,
      isPermitted: body.isPermitted,
    });
    return res.status(201).json(item);
  } catch (e: any) {
    if (e?.code === "P2002") return sendError(res, 409, "State already exists for this country");
    return sendError(res, 500, "Failed to create state", e?.message);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const item = await service.updateState(req.params.id, {
      name: body.name,
      countryId: body.countryId,
      isActive: body.isActive,
      isPermitted: body.isPermitted,
    });
    return res.json(item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update state", e?.message);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deleteState(req.params.id);
    return res.json({ success: true, deleted: true });
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete state", e?.message);
  }
}
