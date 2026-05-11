"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugifyProfileValue = slugifyProfileValue;
exports.isUuidLike = isUuidLike;
exports.publicSlugRequestMatches = publicSlugRequestMatches;
exports.getPublicProfileSlug = getPublicProfileSlug;
const display_name_1 = require("./display-name");
function slugifyProfileValue(value) {
    return String(value ?? "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}
function isUuidLike(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}
/**
 * True if a URL segment (e.g. `maxx`) should resolve to this profile's canonical slug
 * (e.g. `maxx-trade-fairs`). Supports exact match, `maxx-*` prefix, and first hyphen segment.
 * Requests shorter than 3 chars only match exactly (avoids overly broad matches).
 */
function publicSlugRequestMatches(canonicalSlug, requestedRaw) {
    const req = slugifyProfileValue(requestedRaw);
    const can = slugifyProfileValue(canonicalSlug);
    if (!req || !can)
        return false;
    if (req.length < 3)
        return can === req;
    if (can === req)
        return true;
    if (can.startsWith(`${req}-`))
        return true;
    const first = can.split("-").filter(Boolean)[0] ?? "";
    return first === req;
}
function getPublicProfileSlug(user, preferredRole) {
    const role = (preferredRole ?? String(user.role ?? "").toUpperCase());
    const fullName = `${String(user.firstName ?? "").trim()} ${String(user.lastName ?? "").trim()}`.trim();
    if (role === "ORGANIZER") {
        return (slugifyProfileValue(user.organizationName) ||
            slugifyProfileValue(user.company) ||
            slugifyProfileValue(user.firstName) ||
            "organizer");
    }
    if (role === "EXHIBITOR") {
        return (slugifyProfileValue(user.organizationName) ||
            slugifyProfileValue(user.company) ||
            slugifyProfileValue(user.firstName) ||
            "exhibitor");
    }
    if (role === "SPEAKER" || role === "ATTENDEE" || role === "USER") {
        return (slugifyProfileValue(fullName) ||
            slugifyProfileValue((0, display_name_1.getDisplayName)(user)) ||
            "user");
    }
    return slugifyProfileValue((0, display_name_1.getDisplayName)(user)) || "user";
}
