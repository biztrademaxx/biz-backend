/** Parse dates/times from spreadsheet cells (Excel serials, DD-MM-YYYY, YYYY-MM-DD, etc.). */

export type CalendarParts = { year: number; month: number; day: number };
export type ClockParts = { hours: number; minutes: number };

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

export const DEFAULT_IMPORT_TIMEZONE = "Asia/Kolkata";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isExcelSerial(n: number): boolean {
  return n >= 1 && n < 1_000_000;
}

function calendarFromExcelSerial(serial: number): CalendarParts {
  const ms = EXCEL_EPOCH_MS + Math.round(serial * 86400000);
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function calendarFromDateInstance(value: Date): CalendarParts {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function normalizeDateInput(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw === "number") return raw;
  let text = String(raw).trim().replace(/\u00a0/g, " ");
  text = text.replace(/[\u2013\u2014\u2212]/g, "-");
  return text;
}

/** Parse `01-08-2026`, `2026-08-01`, `01/08/2026`, Excel serials, etc. */
export function parseCalendarParts(raw: unknown): CalendarParts | null {
  if (raw === null || raw === undefined) return null;

  const normalized = normalizeDateInput(raw);

  if (typeof normalized === "number" && Number.isFinite(normalized) && isExcelSerial(normalized)) {
    return calendarFromExcelSerial(normalized);
  }

  const trimmed = String(normalized).trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n) && isExcelSerial(n)) return calendarFromExcelSerial(n);
  }

  if (trimmed.includes("$type") && trimmed.includes("DateTime")) {
    try {
      let jsonStr = trimmed;
      if (!jsonStr.startsWith("{")) jsonStr = `{${jsonStr}`;
      if (!jsonStr.endsWith("}")) jsonStr = `${jsonStr}}`;
      jsonStr = jsonStr.replace(/\\"/g, '"');
      const parsed = JSON.parse(jsonStr) as { value?: string };
      if (parsed.value) {
        const d = new Date(parsed.value);
        if (!Number.isNaN(d.getTime())) return calendarFromDateInstance(d);
      }
    } catch {
      /* fall through */
    }
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    if (isValidCalendar(year, month, day)) return { year, month, day };
  }

  const dashed = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashed) {
    const a = parseInt(dashed[1], 10);
    const b = parseInt(dashed[2], 10);
    const year = parseInt(dashed[3], 10);
    // DD-MM-YYYY (India / guidelines for dashed dates like 01-08-2026)
    const day = a;
    const month = b;
    if (isValidCalendar(year, month, day)) return { year, month, day };
  }

  const slashed = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashed) {
    const a = parseInt(slashed[1], 10);
    const b = parseInt(slashed[2], 10);
    const year = parseInt(slashed[3], 10);
    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    if (isValidCalendar(year, month, day)) return { year, month, day };
  }

  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const day = parseInt(dotted[1], 10);
    const month = parseInt(dotted[2], 10);
    const year = parseInt(dotted[3], 10);
    if (isValidCalendar(year, month, day)) return { year, month, day };
  }

  // Do not use `new Date("01-08-2026")` — JS may treat it as MM-DD.
  return null;
}

function isValidCalendar(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() + 1 === month &&
    probe.getUTCDate() === day
  );
}

/** Legacy helper — midnight UTC for the parsed calendar day. */
export function parseDateString(dateStr: unknown): Date {
  const parts = parseCalendarParts(dateStr);
  if (!parts) {
    throw new Error(
      `Invalid date: ${dateStr === undefined || dateStr === null || String(dateStr).trim() === "" ? "(empty)" : String(dateStr)}. Use DD-MM-YYYY.`,
    );
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
}

export function parseImportTimezone(raw: unknown): string {
  const tz = String(raw ?? "").trim();
  return tz || DEFAULT_IMPORT_TIMEZONE;
}

export function parseTimeParts(raw: unknown, fallback: string): ClockParts {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const fraction = raw - Math.floor(raw);
    const totalMinutes = Math.round(fraction * 24 * 60);
    return {
      hours: Math.floor(totalMinutes / 60) % 24,
      minutes: totalMinutes % 60,
    };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { hours: raw.getHours(), minutes: raw.getMinutes() };
  }

  const str = String(raw ?? "").trim();
  if (!str) {
    const [fh, fm] = fallback.split(":").map((x) => parseInt(x, 10));
    return { hours: fh, minutes: fm };
  }

  const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp][Mm]))?$/);
  if (!m) {
    const [fh, fm] = fallback.split(":").map((x) => parseInt(x, 10));
    return { hours: fh, minutes: fm };
  }

  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const ampm = m[4]?.toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) {
    const [fh, fm] = fallback.split(":").map((x) => parseInt(x, 10));
    return { hours: fh, minutes: fm };
  }
  return { hours, minutes };
}

function getZonedParts(utcMs: number, timeZone: string): CalendarParts & ClockParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of formatter.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hours: parseInt(map.hour, 10),
    minutes: parseInt(map.minute, 10),
  };
}

/** Wall-clock date + time in `timeZone` → UTC instant stored in DB. */
export function combineDateAndTimeInTimeZone(
  date: CalendarParts,
  time: ClockParts,
  timeZone: string,
): Date {
  const desiredMs = Date.UTC(date.year, date.month - 1, date.day, time.hours, time.minutes, 0);
  let utc = desiredMs;

  for (let i = 0; i < 5; i++) {
    const got = getZonedParts(utc, timeZone);
    const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hours, got.minutes, 0);
    const diff = desiredMs - gotMs;
    if (diff === 0) break;
    utc += diff;
  }

  return new Date(utc);
}

export function parseImportedDateTime(
  dateRaw: unknown,
  timeRaw: unknown,
  fallbackTime: string,
  timeZone: string,
  fieldName = "date",
): Date {
  const date = parseCalendarParts(dateRaw);
  if (!date) {
    const preview =
      dateRaw === undefined || dateRaw === null || String(dateRaw).trim() === ""
        ? "(empty)"
        : String(dateRaw).slice(0, 48);
    throw new Error(`Invalid ${fieldName}: "${preview}". Use DD-MM-YYYY (e.g. 01-08-2027).`);
  }
  const time = parseTimeParts(timeRaw, fallbackTime);
  return combineDateAndTimeInTimeZone(date, time, timeZone);
}

export function formatCalendarParts(parts: CalendarParts): string {
  return `${pad2(parts.day)}-${pad2(parts.month)}-${parts.year}`;
}
