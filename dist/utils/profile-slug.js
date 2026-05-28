"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugifyProfileValue = slugifyProfileValue;
exports.isUuidLike = isUuidLike;
exports.isUuidSegment = isUuidSegment;
exports.isMongoObjectId = isMongoObjectId;
exports.publicSlugRequestMatches = publicSlugRequestMatches;
exports.getExhibitorSlugCandidates = getExhibitorSlugCandidates;
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
/** Any standard 8-4-4-4-12 hex UUID (URL segment); use with Prisma `id` when strict `isUuidLike` is too narrow. */
function isUuidSegment(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
}
/** Prisma Mongo `@db.ObjectId` — 24 hex chars (not the same as hyphenated UUID). */
function isMongoObjectId(value) {
    return /^[a-f\d]{24}$/i.test(String(value ?? "").trim());
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
/** All URL segments that may identify an exhibitor (org, company, name variants, display name). */
function getExhibitorSlugCandidates(user) {
    const fullName = `${String(user.firstName ?? "").trim()} ${String(user.lastName ?? "").trim()}`.trim();
    const display = (0, display_name_1.getDisplayName)({
        role: "EXHIBITOR",
        firstName: user.firstName,
        lastName: user.lastName,
        organizationName: user.organizationName,
        company: user.company,
    });
    const parts = [
        user.organizationName,
        user.company,
        fullName,
        user.firstName,
        user.lastName,
        display,
    ];
    const out = [];
    const seen = new Set();
    for (const p of parts) {
        const s = slugifyProfileValue(p);
        if (s && !seen.has(s)) {
            seen.add(s);
            out.push(s);
        }
    }
    return out;
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
        const candidates = getExhibitorSlugCandidates(user);
        return candidates[0] ?? "exhibitor";
    }
    if (role === "SPEAKER" || role === "ATTENDEE" || role === "USER") {
        return (slugifyProfileValue(fullName) ||
            slugifyProfileValue((0, display_name_1.getDisplayName)(user)) ||
            "user");
    }
    return slugifyProfileValue((0, display_name_1.getDisplayName)(user)) || "user";
}
