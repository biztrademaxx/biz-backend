import type { Request, Response } from "express";
import { resolveVisitorGeo } from "./geo.service";

/** GET /api/geo/visitor — IP → country/city (no browser permission). */
export async function getVisitorGeo(req: Request, res: Response) {
  try {
    const geo = await resolveVisitorGeo(req.headers, req.socket?.remoteAddress ?? null);
    return res.json(geo);
  } catch (e) {
    console.error("getVisitorGeo:", e);
    return res.status(500).json({
      city: null,
      region: null,
      countryCode: null,
      countryName: null,
    });
  }
}
