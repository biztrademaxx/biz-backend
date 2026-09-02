/**
 * Duplicate detection for bulk event import.
 *
 * Same spreadsheet row / existing event when:
 *   eventTitle (normalized) + startDate (spreadsheet calendar day) match
 * Venue is only used to allow a second edition on the same day at a *different* named venue.
 * Missing venue on either side still counts as a duplicate (typical re-upload).
 */
import prisma from "../../../config/prisma";
import {
  calendarPartsInTimeZone,
  DEFAULT_IMPORT_TIMEZONE,
  formatCalendarParts,
  parseCalendarParts,
  parseImportTimezone,
  parseImportedDateTime,
  type CalendarParts,
} from "./event-import-parse";

export function normalizeImportLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatCalendarDay(parts: CalendarParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function calendarFromRow(row: Record<string, unknown>): CalendarParts {
  const fromCell = parseCalendarParts(row.startDate);
  if (fromCell) return fromCell;
  const timeZone = parseImportTimezone(row.timezone);
  const instant = parseImportedDateTime(row.startDate, row.startTime, "10:00", timeZone);
  return calendarPartsInTimeZone(instant, timeZone);
}

function slugBase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export type ImportDuplicateFingerprint = {
  title: string;
  titleNorm: string;
  calendar: CalendarParts;
  calendarDay: string;
  startDate: Date;
  venueNameNorm: string;
  cityNorm: string;
  slug: string;
};

export function buildImportDuplicateFingerprint(
  row: Record<string, unknown>,
): ImportDuplicateFingerprint {
  const title = String(row.eventTitle ?? "").trim();
  const titleNorm = normalizeImportLabel(title);
  const calendar = calendarFromRow(row);
  const calendarDay = formatCalendarDay(calendar);
  const timeZone = parseImportTimezone(row.timezone);
  const startDate = parseImportedDateTime(row.startDate, row.startTime, "10:00", timeZone);
  const venueNameNorm = normalizeImportLabel(row.venueName);
  const cityNorm = normalizeImportLabel(row.city ?? row.cityNames ?? row.cityName);
  const slug = slugBase(String(row.slug || row.eventSlug || title || ""));
  return {
    title,
    titleNorm,
    calendar,
    calendarDay,
    startDate,
    venueNameNorm,
    cityNorm,
    slug,
  };
}

export function duplicateKeyFromFingerprint(fp: ImportDuplicateFingerprint): string {
  return `${fp.titleNorm}|${fp.calendarDay}|${fp.venueNameNorm}`;
}

export function formatDuplicateKeyForMessage(fp: ImportDuplicateFingerprint): string {
  const venuePart = fp.venueNameNorm ? fp.venueNameNorm : "(no venue)";
  return `"${fp.title}" on ${formatCalendarParts(fp.calendar)} at ${venuePart}`;
}

/**
 * Two named venues on the same day are different editions.
 * Empty venue on either side is treated as the same event (re-upload / venue not linked).
 */
export function venuesAreDistinctEdition(incomingNorm: string, existingNorm: string): boolean {
  if (!incomingNorm || !existingNorm) return false;
  return incomingNorm !== existingNorm;
}

export function titlesMatch(existingTitle: string, incomingNorm: string): boolean {
  return normalizeImportLabel(existingTitle) === incomingNorm;
}

export function eventMatchesSpreadsheetDay(
  startDate: Date,
  timezone: string | null | undefined,
  sheet: CalendarParts,
): boolean {
  const zones = [timezone, DEFAULT_IMPORT_TIMEZONE, "UTC"].filter(
    (z, i, arr): z is string => Boolean(z) && arr.indexOf(z) === i,
  );
  return zones.some((tz) => {
    const p = calendarPartsInTimeZone(startDate, tz);
    return p.year === sheet.year && p.month === sheet.month && p.day === sheet.day;
  });
}

type ExistingEventForDedupe = {
  title: string;
  startDate: Date;
  timezone?: string | null;
  city?: string | null;
  slug?: string | null;
  venue?: { venueName?: string | null } | null;
};

export function eventMatchesFingerprint(
  existing: ExistingEventForDedupe,
  fp: ImportDuplicateFingerprint,
): boolean {
  if (!titlesMatch(existing.title, fp.titleNorm)) return false;
  if (!eventMatchesSpreadsheetDay(existing.startDate, existing.timezone, fp.calendar)) {
    return false;
  }
  const existingVenue = normalizeImportLabel(existing.venue?.venueName) || normalizeImportLabel(existing.city);
  const incomingVenue = fp.venueNameNorm || fp.cityNorm;
  if (venuesAreDistinctEdition(incomingVenue, existingVenue)) return false;
  return true;
}

/**
 * True if an event already exists for this spreadsheet row.
 */
export async function findExistingEventDuplicate(
  fp: ImportDuplicateFingerprint,
): Promise<boolean> {
  if (!fp.titleNorm) return false;

  if (fp.slug) {
    const bySlug = await prisma.event.findUnique({
      where: { slug: fp.slug },
      select: {
        title: true,
        startDate: true,
        timezone: true,
        city: true,
        slug: true,
        venue: { select: { venueName: true } },
      },
    });
    if (bySlug && eventMatchesFingerprint(bySlug, fp)) return true;
  }

  const dayStartUtc = Date.UTC(fp.calendar.year, fp.calendar.month - 1, fp.calendar.day);
  const windowStart = new Date(dayStartUtc - 36 * 60 * 60 * 1000);
  const windowEnd = new Date(dayStartUtc + 48 * 60 * 60 * 1000);

  const titleToken = fp.titleNorm.split(" ").filter((w) => w.length >= 3)[0];
  const candidates = await prisma.event.findMany({
    where: {
      startDate: { gte: windowStart, lt: windowEnd },
      ...(titleToken
        ? { title: { contains: titleToken, mode: "insensitive" } }
        : { title: { equals: fp.title, mode: "insensitive" } }),
    },
    select: {
      title: true,
      startDate: true,
      timezone: true,
      city: true,
      slug: true,
      venue: { select: { venueName: true } },
    },
    take: 2000,
  });

  return candidates.some((ev) => eventMatchesFingerprint(ev, fp));
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

/** @deprecated Use spreadsheet calendar day; kept for older tests. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
