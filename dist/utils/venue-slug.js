"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugifyVenueSegment = slugifyVenueSegment;
exports.isUuidParam = isUuidParam;
/** Must match `utils/slugify.ts` in biz-frontend for venue dashboard URLs. */
function slugifyVenueSegment(input) {
    return String(input ?? "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}
function isUuidParam(segment) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(segment ?? "").trim());
}
