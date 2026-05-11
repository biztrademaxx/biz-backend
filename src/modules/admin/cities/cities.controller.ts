import { Request, Response } from "express";
import { sendError } from "../../../lib/admin-response";
import * as service from "./cities.service";

export async function list(req: Request, res: Response) {
  try {
    const includeCounts = req.query.includeCounts === "true";
    const data = await service.listCities(includeCounts);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list cities", e?.message);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const item = await service.getCityById(req.params.id);
    if (!item) return sendError(res, 404, "City not found");
    return res.json(item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get city", e?.message);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    if (!body.name || !body.state || !body.countryId) {
      return sendError(res, 400, "name, state and countryId are required");
    }
    const item = await service.createCity({
      name: body.name,
      state: body.state,
      countryId: body.countryId,
      latitude: body.latitude != null ? Number(body.latitude) : undefined,
      longitude: body.longitude != null ? Number(body.longitude) : undefined,
      timezone: body.timezone,
      image: body.image,
      imagePublicId: body.imagePublicId,
      isActive: body.isActive,
      isPermitted: body.isPermitted,
    });
    return res.status(201).json(item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to create city", e?.message);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const item = await service.updateCity(req.params.id, {
      name: body.name,
      state: body.state,
      countryId: body.countryId,
      latitude: body.latitude != null ? Number(body.latitude) : undefined,
      longitude: body.longitude != null ? Number(body.longitude) : undefined,
      timezone: body.timezone,
      image: body.image,
      imagePublicId: body.imagePublicId,
      isActive: body.isActive,
      isPermitted: body.isPermitted,
    });
    return res.json(item);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update city", e?.message);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deleteCity(req.params.id);
    return res.json({ success: true, deleted: true });
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete city", e?.message);
  }
}
