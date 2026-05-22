/**
 * Duplicate detection for bulk event import.
 * Match when eventTitle + startDate (calendar day) + venueName all match.
 * Same title on different dates or venues is allowed.
 */
import prisma from "../../../config/prisma";
import { parseDateString } from "./event-import-parse";

export function normalizeImportLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseTimeStringForImport(
  raw: unknown,
  fallback: string,
): { hours: number; minutes: number } {
  const str = String(raw ?? "").trim();
  if (!str) {
    const [fh, fm] = fallback.split(":").map((x) => parseInt(x, 10));
    return { hours: fh, minutes: fm };
  }
  const m = str.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  if (!m) {
    const [fh, fm] = fallback.split(":").map((x) => parseInt(x, 10));
    return { hours: fh, minutes: fm };
  }
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) {
    const [fh, fm] = fallback.split(":").map((x) => parseInt(x, 10));
    return { hours: fh, minutes: fm };
  }
  return { hours, minutes };
}

export function combineDateAndTimeForImport(
  date: Date,
  time: { hours: number; minutes: number },
): Date {
  const d = new Date(date);
  d.setHours(time.hours, time.minutes, 0, 0);
  return d;
}

/** Parsed start instant used for duplicate key (same rules as import body). */
export function parseRowStartDate(row: Record<string, unknown>): Date {
  const baseStartDate = parseDateString(row.startDate);
  const startTime = parseTimeStringForImport(row.startTime, "10:00");
  return combineDateAndTimeForImport(baseStartDate, startTime);
}

export type ImportDuplicateFingerprint = {
  title: string;
  titleNorm: string;
  startDate: Date;
  venueNameNorm: string;
};

export function buildImportDuplicateFingerprint(
  row: Record<string, unknown>,
): ImportDuplicateFingerprint {
  const title = String(row.eventTitle ?? "").trim();
  const titleNorm = normalizeImportLabel(title);
  const startDate = parseRowStartDate(row);
  const venueNameNorm = normalizeImportLabel(row.venueName);
  return { title, titleNorm, startDate, venueNameNorm };
}

export function duplicateKeyFromFingerprint(fp: ImportDuplicateFingerprint): string {
  const day = startOfUtcDay(fp.startDate).toISOString().slice(0, 10);
  return `${fp.titleNorm}|${day}|${fp.venueNameNorm}`;
}

export function formatDuplicateKeyForMessage(fp: ImportDuplicateFingerprint): string {
  const day = startOfUtcDay(fp.startDate).toISOString().slice(0, 10);
  const venuePart = fp.venueNameNorm ? fp.venueNameNorm : "(no venue)";
  return `"${fp.title}" on ${day} at ${venuePart}`;
}

/**
 * True if an event already exists with same title (case-insensitive), same UTC start day, same venue name.
 */
export async function findExistingEventDuplicate(
  fp: ImportDuplicateFingerprint,
): Promise<boolean> {
  if (!fp.titleNorm) return false;

  const dayStart = startOfUtcDay(fp.startDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const candidates = await prisma.event.findMany({
    where: {
      title: { equals: fp.title, mode: "insensitive" },
      startDate: { gte: dayStart, lt: dayEnd },
    },
    select: {
      venue: { select: { venueName: true } },
    },
    take: 100,
  });

  for (const ev of candidates) {
    const existingVenueNorm = normalizeImportLabel(ev.venue?.venueName ?? "");
    if (existingVenueNorm === fp.venueNameNorm) return true;
  }
  return false;
}

export function duplicateSkipMessage(
  fp: ImportDuplicateFingerprint,
  reason: "spreadsheet" | "database",
  detail?: string,
): string {
  const base = formatDuplicateKeyForMessage(fp);
  if (reason === "spreadsheet") {
    return `Duplicate (skipped) — same title, start date, and venue as another row in this file: ${base}${detail ? ` (${detail})` : ""}`;
  }
  return `Duplicate (skipped) — event already exists in database: ${base}`;
}
