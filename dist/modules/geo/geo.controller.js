"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVisitorGeo = getVisitorGeo;
const geo_service_1 = require("./geo.service");
/** GET /api/geo/visitor — IP → country/city (no browser permission). */
async function getVisitorGeo(req, res) {
    try {
        const geo = await (0, geo_service_1.resolveVisitorGeo)(req.headers, req.socket?.remoteAddress ?? null);
        return res.json(geo);
    }
    catch (e) {
        console.error("getVisitorGeo:", e);
        return res.status(500).json({
            city: null,
            region: null,
            countryCode: null,
            countryName: null,
        });
    }
}
