"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemporaryPortalPassword = generateTemporaryPortalPassword;
const crypto_1 = require("crypto");
/** Meets the same rules as `validatePortalPassword` in auth routes (length, upper, lower, digit). */
function generateTemporaryPortalPassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const all = upper + lower + digits;
    const chars = [
        upper[(0, crypto_1.randomInt)(upper.length)],
        lower[(0, crypto_1.randomInt)(lower.length)],
        digits[(0, crypto_1.randomInt)(digits.length)],
    ];
    const len = 12;
    while (chars.length < len) {
        chars.push(all[(0, crypto_1.randomInt)(all.length)]);
    }
    for (let i = chars.length - 1; i > 0; i--) {
        const j = (0, crypto_1.randomInt)(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
}
