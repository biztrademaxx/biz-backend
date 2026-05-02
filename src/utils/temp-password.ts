import { randomBytes } from "crypto";

/**
 * Generate a one-time temporary password for admin-created accounts.
 *
 * - 12 chars, alphanumeric + at least one digit and one uppercase letter (passes most strength checks).
 * - URL/email safe so it copy-pastes cleanly out of HTML mail clients.
 * - This is a *throwaway* credential: we email it together with a reset link so the recipient can
 *   either sign in once and change it, or click the link and pick their own.
 */
export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude I, O for legibility
  const lower = "abcdefghijkmnopqrstuvwxyz"; // exclude l
  const digits = "23456789"; // exclude 0, 1
  const all = upper + lower + digits;

  const buf = randomBytes(12);
  const pickFrom = (set: string, byte: number) => set[byte % set.length];

  // Guarantee at least one uppercase, one lowercase, one digit, then fill the rest.
  const required = [
    pickFrom(upper, buf[0]),
    pickFrom(lower, buf[1]),
    pickFrom(digits, buf[2]),
  ];
  const filler: string[] = [];
  for (let i = 3; i < 12; i++) filler.push(pickFrom(all, buf[i]));

  const chars = [...required, ...filler];
  // Fisher–Yates shuffle so the required chars aren't always at the front.
  const shuffleBuf = randomBytes(chars.length);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBuf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
