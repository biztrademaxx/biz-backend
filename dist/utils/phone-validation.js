"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlaceholderOrInvalidPhone = isPlaceholderOrInvalidPhone;
function phoneDigitsOnly(raw) {
    return raw.replace(/\D/g, "");
}
/** True if phone should not be stored (placeholder / autofill junk). */
function isPlaceholderOrInvalidPhone(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return true;
    const digits = phoneDigitsOnly(trimmed);
    if (digits.length < 8 || digits.length > 15)
        return true;
    if (/^(\d)\1+$/.test(digits))
        return true;
    const duds = new Set([
        "1234567890",
        "0123456789",
        "0987654321",
        "9876543210",
        "1111111111",
        "0000000000",
        "123456789",
        "12345678",
    ]);
    if (duds.has(digits))
        return true;
    return false;
}
