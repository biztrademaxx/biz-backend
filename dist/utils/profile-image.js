"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPublicProfileImage = hasPublicProfileImage;
/** True when URL is suitable for public/featured profile display (not empty, not placeholder). */
function hasPublicProfileImage(url) {
    const raw = String(url ?? "").trim();
    if (!raw)
        return false;
    const lower = raw.toLowerCase();
    if (lower.includes("placeholder.svg"))
        return false;
    if (lower.includes("text=org") || lower.includes("text=avatar"))
        return false;
    return true;
}
