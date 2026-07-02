/**
 * Duplicate detection for bulk event import.
 * Match when eventTitle + startDate (calendar day) + venueName all match.
 * Same title on different dates or venues is allowed..
 */
import prisma from "../../../config/prisma";
import { parseImportTimezone, parseImportedDateTime } from "./event-import-parse";

export function normalizeImportLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Parsed start instant used for duplicate key (same rules as import body). */
export function parseRowStartDate(row: Record<string, unknown>): Date {
  const timeZone = parseImportTimezone(row.timezone);
  return parseImportedDateTime(row.startDate, row.startTime, "10:00", timeZone);
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
 * True if an event already exists with same title (case-insensitive), same UTC start day, same venue name..
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
