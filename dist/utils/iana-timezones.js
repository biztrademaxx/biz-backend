"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeVenueTimezoneInput = normalizeVenueTimezoneInput;
/** Normalize venue timezone from API input: empty clears; invalid omits update (undefined). */
function normalizeVenueTimezoneInput(raw) {
    if (raw === undefined)
        return undefined;
    const s = String(raw ?? "").trim();
    if (!s)
        return null;
    try {
        const intl = Intl;
        const list = typeof intl.supportedValuesOf === "function"
            ? intl.supportedValuesOf.call(Intl, "timeZone")
            : [];
        const allowed = new Set(list);
        if (allowed.has(s))
            return s;
    }
    catch {
        if (s === "UTC")
            return "UTC";
    }
    return undefined;
}
