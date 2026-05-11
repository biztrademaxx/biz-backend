import { Request, Response } from "express";
import { sendError } from "../../../lib/admin-response";
import * as service from "./countries.service";

export async function list(req: Request, res: Response) {
  try {
    const includeCounts = req.query.includeCounts === "true";
    const data = await service.listCountries(includeCounts);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list countries", e?.message);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const item = await service.getCountryById(req.params.id);
    if (!item) return sendError(res, 404, "Country not found");
    return res.json(item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get country", e?.message);
  }
}

export async function listStates(req: Request, res: Response) {
  try {
    const countryCode = typeof req.query.countryCode === "string" ? req.query.countryCode : undefined;
    const data = await service.listStateStats(countryCode);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list states", e?.message);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const item = await service.createCountry({
      name: body.name,
      code: body.code,
      flag: body.flag,
      flagPublicId: body.flagPublicId,
      currency: body.currency,
      timezone: body.timezone,
      isActive: body.isActive,
      isPermitted: body.isPermitted,
    });
    return res.status(201).json(item);
  } catch (e: any) {
    if (e?.message?.includes("already exists"))
      return sendError(res, 409, e.message);
    return sendError(res, 500, "Failed to create country", e?.message);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const item = await service.updateCountry(req.params.id, {
      name: body.name,
      code: body.code,
      flag: body.flag,
      flagPublicId: body.flagPublicId,
      currency: body.currency,
      timezone: body.timezone,
      isActive: body.isActive,
      isPermitted: body.isPermitted,
    });
    return res.json(item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update country", e?.message);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deleteCountry(req.params.id);
    return res.json({ success: true, deleted: true });
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete country", e?.message);
  }
}
