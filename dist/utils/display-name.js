"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nameFromEmailLocalPart = nameFromEmailLocalPart;
exports.getDisplayName = getDisplayName;
function normalizeWhitespace(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}
function fullName(first, last) {
    return normalizeWhitespace(`${normalizeWhitespace(first)} ${normalizeWhitespace(last)}`);
}
/**
 * Display name from the email local-part (text before `@`).
 * `john.doe@gmail.com` → `John Doe`; `maxxmedia@biz.com` → `Maxxmedia`.
 */
function nameFromEmailLocalPart(email) {
    const raw = String(email ?? "").trim();
    if (!raw)
        return "";
    const at = raw.indexOf("@");
    const local = (at >= 0 ? raw.slice(0, at) : raw).trim();
    if (!local)
        return "";
    const cleaned = local
        .replace(/[._+-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const source = cleaned || local;
    return source
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}
/**
 * Role-based display name for dashboards and API payloads.
 * - ORGANIZER: organizationName → firstName → "User"
 * - EXHIBITOR: organizationName || company → firstName → "User"
 * - SPEAKER / ATTENDEE: firstName + lastName → "User"
 * - VENUE_MANAGER: venueName → firstName + lastName → "User"
 * - Other roles: firstName + lastName → "User"
 */
function getDisplayName(user) {
    const role = String(user.role ?? "").toUpperCase();
    switch (role) {
        case "VENUE_MANAGER": {
            const venue = normalizeWhitespace(user.venueName) || normalizeWhitespace(user.company);
            if (venue)
                return venue;
            const n = fullName(user.firstName, user.lastName);
            if (n && n.toLowerCase() !== "user user" && n.toLowerCase() !== "venue manager") {
                return n;
            }
            return "User";
        }
        case "ORGANIZER": {
            const org = normalizeWhitespace(user.organizationName) || normalizeWhitespace(user.company);
            if (org)
                return org;
            const fn = normalizeWhitespace(user.firstName);
            if (fn)
                return fn;
            return "User";
        }
        case "EXHIBITOR": {
            const primary = normalizeWhitespace(user.organizationName) || normalizeWhitespace(user.company);
            if (primary)
                return primary;
            const fn = normalizeWhitespace(user.firstName);
            if (fn)
                return fn;
            return "User";
        }
        case "SPEAKER":
        case "ATTENDEE": {
            const n = fullName(user.firstName, user.lastName);
            return n || "User";
        }
        default: {
            const n = fullName(user.firstName, user.lastName);
            return n || "User";
        }
    }
}
