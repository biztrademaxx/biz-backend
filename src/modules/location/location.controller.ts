import { Request, Response } from "express";
import * as service from "./location.service";

export async function listCountries(_req: Request, res: Response) {
  try {
    const data = await service.listPublicCountries();
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Failed to list countries",
    });
  }
}

export async function listCities(req: Request, res: Response) {
  try {
    const countryId = typeof req.query.countryId === "string" ? req.query.countryId : undefined;
    const data = await service.listPublicCities(countryId);
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Failed to list cities",
    });
  }
}
