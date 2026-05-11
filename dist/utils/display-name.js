"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
 * Role-based display name for dashboards and API payloads.
 * - ORGANIZER: organizationName → firstName → "User"
 * - EXHIBITOR: organizationName || company → firstName → "User"
 * - SPEAKER / ATTENDEE: firstName + lastName → "User"
 * - Other roles: firstName + lastName → "User"
 */
function getDisplayName(user) {
    const role = String(user.role ?? "").toUpperCase();
    switch (role) {
        case "ORGANIZER": {
            const org = normalizeWhitespace(user.organizationName);
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
