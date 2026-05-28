"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVisitorGeo = resolveVisitorGeo;
const EMPTY = {
    city: null,
    region: null,
    countryCode: null,
    countryName: null,
};
const COUNTRY_NAMES = {
    IN: "India",
    AE: "United Arab Emirates",
    US: "United States",
    GB: "United Kingdom",
    DE: "Germany",
    FR: "France",
    SG: "Singapore",
    AU: "Australia",
    CA: "Canada",
    JP: "Japan",
    CN: "China",
};
function isPrivateIP(ip) {
    return (ip.startsWith("127.") ||
        ip.startsWith("192.168.") ||
        ip.startsWith("10.") ||
        ip.startsWith("172.") ||
        ip === "::1");
}
function countryNameFromCode(code) {
    if (!code)
        return null;
    const cc = code.toUpperCase();
    return COUNTRY_NAMES[cc] ?? cc;
}
function geoFromProxyHeaders(headers) {
    const countryCode = headers["x-vercel-ip-country"]?.trim()?.toUpperCase() || null;
    if (!countryCode)
        return null;
    return {
        city: headers["x-vercel-ip-city"]?.trim() || null,
        region: headers["x-vercel-ip-country-region"]?.trim() || null,
        countryCode,
        countryName: countryNameFromCode(countryCode),
    };
}
async function resolveVisitorGeo(headers, socketIp) {
    const fromEdge = geoFromProxyHeaders(headers);
    if (fromEdge)
        return fromEdge;
    const forwarded = headers["x-forwarded-for"]
        ?.split(",")[0]
        ?.trim();
    const realIp = headers["x-real-ip"]?.trim();
    let ip = forwarded && !isPrivateIP(forwarded) ? forwarded : null;
    if (!ip && realIp && !isPrivateIP(realIp))
        ip = realIp;
    if (!ip && socketIp && !isPrivateIP(socketIp))
        ip = socketIp;
    try {
        const url = ip
            ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
            : "https://ipapi.co/json/";
        const r = await fetch(url);
        if (!r.ok)
            return EMPTY;
        const d = (await r.json());
        if (d.error)
            return EMPTY;
        const countryCode = typeof d.country_code === "string" ? d.country_code.trim().toUpperCase() : null;
        return {
            city: typeof d.city === "string" ? d.city : null,
            region: typeof d.region === "string" ? d.region : null,
            countryCode,
            countryName: typeof d.country_name === "string"
                ? d.country_name
                : countryNameFromCode(countryCode),
        };
    }
    catch {
        return EMPTY;
    }
}
