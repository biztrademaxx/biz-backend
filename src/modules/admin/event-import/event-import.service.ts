/**
 * Bulk event import from CSV/TSV/XLSX — uses createEventAdmin + findOrCreateUser from events-writes.
 */
import { randomBytes } from "crypto";
import * as XLSX from "xlsx";
import prisma from "../../../config/prisma";
import { normalizeYoutubeVideoUrlForStorage } from "../../../utils/youtube-url";
import { createEventAdmin, findOrCreateUser } from "../../events/events-writes.service";
import { sendEventImportThankYouEmail, FRONTEND_BASE } from "../../../services/email.service";

const BATCH_PAUSE_MS = 5;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse dates from spreadsheet cells (incl. Excel/Vercel odd formats). */
export function parseDateString(dateStr: unknown): Date {
  if (dateStr === null || dateStr === undefined || String(dateStr).trim() === "") {
    return new Date();
  }

  const str = String(dateStr).trim();

  if (str.includes("$type") && str.includes("DateTime")) {
    try {
      let jsonStr = str;
      if (!jsonStr.startsWith("{")) jsonStr = `{${jsonStr}`;
      if (!jsonStr.endsWith("}")) jsonStr = `${jsonStr}}`;
      jsonStr = jsonStr.replace(/\\"/g, '"');
      const parsed = JSON.parse(jsonStr) as { value?: string };
      if (parsed.value) {
        const date = new Date(parsed.value);
        if (!Number.isNaN(date.getTime())) return date;
      }
    } catch {
      /* fall through */
    }
  }

  if (str.includes("+0") || str.includes("-0")) {
    const isoMatch = str.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      const date = new Date(isoMatch[1]);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  }

  const parts = str.split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (day > 12 && day <= 31) return new Date(year, month - 1, day);
      if (year > 31 && month <= 12 && day <= 31) return new Date(year, month - 1, day);
    }
  }

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return new Date();
  const y = date.getFullYear();
  if (y < 1900 || y > 2100) return new Date();
  return date;
}

export function cleanPhone(phone: unknown): string | undefined {
  if (phone === null || phone === undefined || phone === "") return undefined;
  const phoneStr = String(phone);
  if (phoneStr.startsWith("-")) return `+${phoneStr.substring(1)}`;
  const cleaned = phoneStr.replace(/[^\d+\-()]/g, "");
  return cleaned || undefined;
}

export function parseArray(value: unknown, delimiter: string = ","): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(delimiter).map((s) => s.trim()).filter(Boolean);
  }
  return String(value)
    .split(delimiter)
    .map((s) => s.trim())
    .filter(Boolean);
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

async function ensureUniqueSlug(base: string): Promise<string> {
  let s = slugBase(base) || `event-${randomBytes(4).toString("hex")}`;
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hit = await prisma.event.findUnique({ where: { slug: s } });
    if (!hit) return s;
    n += 1;
    s = `${slugBase(base) || "event"}-${n}`;
  }
}

function parseBool(v: unknown, defaultTrue = true): boolean {
  if (v === null || v === undefined || v === "") return defaultTrue;
  return String(v).toLowerCase() === "true";
}

function parseTimeString(raw: unknown, fallback: string): { hours: number; minutes: number } {
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

function combineDateAndTime(date: Date, time: { hours: number; minutes: number }): Date {
  const d = new Date(date);
  d.setHours(time.hours, time.minutes, 0, 0);
  return d;
}

export function parseWorkbookToRows(buffer: Buffer, _fileName: string): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellNF: false,
    cellText: false,
    raw: true,
  });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    raw: false,
    defval: "",
    dateNF: "yyyy-mm-dd",
  });
}

async function resolveVenueFromRow(row: Record<string, unknown>): Promise<string | null> {
  const venueIdRaw = row.venueId ? String(row.venueId).trim() : "";
  const venueName = row.venueName ? String(row.venueName).trim() : "";
  const venueEmailRaw = row.venueEmail ? String(row.venueEmail).trim() : "";
  if (!venueIdRaw && !venueName && !venueEmailRaw) return null;

  if (venueIdRaw) {
    const byId = await prisma.user.findFirst({
      where: { id: venueIdRaw, role: "VENUE_MANAGER" },
      select: { id: true },
    });
    if (byId?.id) return byId.id;
  }

  if (venueEmailRaw) {
    const byEmail = await prisma.user.findFirst({
      where: { role: "VENUE_MANAGER", email: venueEmailRaw.toLowerCase() },
      select: { id: true },
    });
    if (byEmail?.id) return byEmail.id;
  }
  if (venueName) {
    const byName = await prisma.user.findFirst({
      where: { role: "VENUE_MANAGER", venueName: { equals: venueName, mode: "insensitive" } },
      select: { id: true },
    });
    if (byName?.id) return byName.id;
  }
  throw new Error(
    `Venue not found for provided identifier${venueName ? ` (name: ${venueName})` : ""}${venueEmailRaw ? ` (email: ${venueEmailRaw})` : ""}`,
  );
}

function buildSpeakerSessions(
  row: Record<string, unknown>,
  start: Date,
): Record<string, unknown>[] {
  const emails = parseArray(row.speakerEmails, "|");
  if (emails.length === 0) return [];
  const names = parseArray(row.speakerNames, "|");
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  return emails.map((email, i) => ({
    speakerEmail: email,
    speakerName: names[i] || `Speaker ${i + 1}`,
    title: `Presentation by ${names[i] || "Speaker"}`,
    description: "Imported speaker session",
    sessionType: "PRESENTATION",
    duration: 45,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  }));
}

function buildExhibitorBooths(row: Record<string, unknown>): Record<string, unknown>[] {
  const emails = parseArray(row.exhibitorEmails, "|");
  if (emails.length === 0) return [];
  const names = parseArray(row.exhibitorNames, "|");
  return emails.map((email, i) => ({
    exhibitorEmail: email,
    exhibitorName: names[i] || `Exhibitor ${i + 1}`,
    company: names[i] || `Company ${i + 1}`,
    totalCost: 0,
    currency: "USD",
  }));
}

async function rowToEventBody(
  row: Record<string, unknown>,
  organizerId: string,
  venueId: string | null,
): Promise<Record<string, unknown>> {
  const title = String(row.eventTitle ?? "").trim();
  if (!title) throw new Error("eventTitle is required");

  const baseStartDate = parseDateString(row.startDate);
  const baseEndDate = parseDateString(row.endDate || row.startDate);
  const startTime = parseTimeString(row.startTime, "10:00");
  const endTime = parseTimeString(row.endTime, "18:00");
  const startDate = combineDateAndTime(baseStartDate, startTime);
  const endDate = combineDateAndTime(baseEndDate, endTime);
  const registrationStart = row.registrationStart ? parseDateString(row.registrationStart) : startDate;
  const registrationEnd = row.registrationEnd ? parseDateString(row.registrationEnd) : endDate;

  const categories = [
    ...parseArray(row.category),
    ...parseArray(row.eventCategoryNames),
  ].filter(Boolean);

  const eventTypes = parseArray(row.eventType);
  const tags = parseArray(row.tags);
  const images = parseArray(row.images);
  const videos = parseArray(row.videos);
  const documents = parseArray(row.documents);

  let youtubeVideoUrl: string | undefined;
  if (videos.length > 0) {
    const yt = normalizeYoutubeVideoUrlForStorage(videos[0]);
    if (yt.ok && yt.value) youtubeVideoUrl = yt.value;
  }

  const slug = await ensureUniqueSlug(String(row.slug || row.eventSlug || row.eventTitle || "event"));
  const computedSubtitle = String(row.subTitle ?? row.eventSubTitle ?? row.shortDescription ?? title).trim();

  let metaDescription = row.metaDescription ? String(row.metaDescription) : "";
  const countries = parseArray(row.countryNames);
  const cities = parseArray(row.cityNames);
  if (countries.length) metaDescription = [metaDescription, `Countries: ${countries.join(", ")}`].filter(Boolean).join(" | ");
  if (cities.length) metaDescription = [metaDescription, `Cities: ${cities.join(", ")}`].filter(Boolean).join(" | ");

  const body: Record<string, unknown> = {
    title,
    description: String(row.eventDescription ?? ""),
    shortDescription: row.shortDescription ? String(row.shortDescription) : computedSubtitle,
    subTitle: computedSubtitle,
    slug,
    edition: row.edition ? String(row.edition) : undefined,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    registrationStart: registrationStart.toISOString(),
    registrationEnd: registrationEnd.toISOString(),
    timezone: row.timezone ? String(row.timezone) : "UTC",
    categories,
    category: categories,
    eventType: eventTypes.length > 0 ? eventTypes : parseArray(row.eventTypes),
    tags,
    status: row.status ? String(row.status) : "PUBLISHED",
    isFeatured: parseBool(row.isFeatured, false),
    isVIP: parseBool(row.isVIP, false),
    isPublic: parseBool(row.isPublic, true),
    requiresApproval: parseBool(row.requiresApproval, false),
    allowWaitlist: parseBool(row.allowWaitlist, false),
    maxAttendees: row.maxAttendees ? parseInt(String(row.maxAttendees), 10) : undefined,
    currency: row.currency ? String(row.currency) : "USD",
    isVirtual: parseBool(row.isVirtual, false),
    virtualLink: row.virtualLink ? String(row.virtualLink) : undefined,
    images,
    videos,
    brochure: row.brochure ? String(row.brochure) : undefined,
    layoutPlan: row.layoutPlan ? String(row.layoutPlan) : undefined,
    documents,
    bannerImage: images[0] || undefined,
    thumbnailImage: images[0] || undefined,
    metaTitle: row.metaTitle ? String(row.metaTitle) : undefined,
    metaDescription: metaDescription || undefined,
    refundPolicy: row.refundPolicy ? String(row.refundPolicy) : undefined,
    organizerId,
    venueId,
    importSource: "spreadsheet",
    speakerSessions: buildSpeakerSessions(row, startDate),
    exhibitorBooths: buildExhibitorBooths(row),
  };

  if (youtubeVideoUrl) body.youtubeVideoUrl = youtubeVideoUrl;

  return body;
}

export async function createImportJob(params: {
  buffer: Buffer;
  fileName: string;
  createdByAdminId: string;
  createdByAdminRole?: "SUPER_ADMIN" | "SUB_ADMIN";
}): Promise<{ jobId: string }> {
  const rows = parseWorkbookToRows(params.buffer, params.fileName);
  if (rows.length === 0) {
    throw new Error("No data rows found in file");
  }

  const job = await prisma.eventImportJob.create({
    data: {
      status: "PENDING",
      fileName: params.fileName,
      totalRows: rows.length,
      rowsPayload: rows as object,
      createdByAdminId: params.createdByAdminId,
      createdByAdminRole: params.createdByAdminRole ?? "SUPER_ADMIN",
    },
  });

  void runImportJob(job.id).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[event-import] job failed", job.id, e);
  });

  return { jobId: job.id };
}

async function runImportJob(jobId: string) {
  const job = await prisma.eventImportJob.findUnique({ where: { id: jobId } });
  if (!job || !job.rowsPayload) return;

  await prisma.eventImportJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", processedRows: 0 },
  });

  const rows = job.rowsPayload as Record<string, unknown>[];
  const errors: { row: number; message: string }[] = [];
  const importedSummary: { title: string; organizerEmail: string; organizerWasNew: boolean }[] = [];

  const adminId = job.createdByAdminId || "00000000-0000-0000-0000-000000000000";
  const adminType = job.createdByAdminRole === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const orgEmailRaw = String(row.organizerEmail ?? "").trim().toLowerCase();
      const orgName = String(row.organizerName ?? "").trim();

      let organizer: { id: string; email: string };
      let organizerWasNew = false;
      if (orgEmailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgEmailRaw)) {
        const first = (orgName || "Organizer").split(" ")[0] || "Organizer";
        const last = (orgName || "Organizer").split(" ").slice(1).join(" ") || "";
        const out = await findOrCreateUser({
          email: orgEmailRaw,
          role: "ORGANIZER",
          firstName: first,
          lastName: last,
        });
        organizer = { id: out.user.id, email: out.user.email ?? orgEmailRaw };
        organizerWasNew = out.created;
      } else if (orgName) {
        const syntheticEmail = `organizer-${slugBase(orgName)}-${randomBytes(3).toString("hex")}@import.local`;
        const existingByName = await prisma.user.findFirst({
          where: {
            role: "ORGANIZER",
            OR: [
              { firstName: { equals: orgName.split(" ")[0] || orgName, mode: "insensitive" } },
              { organizationName: { equals: orgName, mode: "insensitive" } },
              { company: { equals: orgName, mode: "insensitive" } },
            ],
          },
          select: { id: true, email: true },
        });
        if (existingByName) {
          organizer = { id: existingByName.id, email: existingByName.email ?? syntheticEmail };
        } else {
          const first = orgName.split(" ")[0] || "Organizer";
          const last = orgName.split(" ").slice(1).join(" ") || "";
          const out = await findOrCreateUser({
            email: syntheticEmail,
            role: "ORGANIZER",
            firstName: first,
            lastName: last,
            company: orgName,
          });
          organizer = { id: out.user.id, email: out.user.email ?? syntheticEmail };
          organizerWasNew = out.created;
        }
      } else {
        throw new Error("Provide organizerEmail or organizerName");
      }

      let venueId: string | null = null;
      try {
        venueId = await resolveVenueFromRow(row);
      } catch (ve: any) {
        // eslint-disable-next-line no-console
        console.warn(`[event-import] row ${rowNum} venue skipped:`, ve?.message);
      }

      const body = await rowToEventBody(row, organizer.id, venueId);
      body.organizerId = organizer.id;

      const result = await createEventAdmin({
        body,
        adminId,
        adminType,
      });

      if ("error" in result) {
        throw new Error(
          result.error === "MISSING_FIELDS"
            ? `Missing: ${(result as { missing?: string[] }).missing?.join(", ")}`
            : String(result.error),
        );
      }

      const title = String(row.eventTitle ?? "").trim();
      importedSummary.push({
        title,
        organizerEmail: organizer.email,
        organizerWasNew: organizerWasNew,
      });

      await prisma.eventImportJob.update({
        where: { id: jobId },
        data: {
          processedRows: i + 1,
          successCount: importedSummary.length,
          importedSummary: importedSummary as object,
          errors: errors.length ? (errors as object) : undefined,
        },
      });

      if (i % 20 === 0) await sleep(BATCH_PAUSE_MS);
    } catch (e: any) {
      errors.push({ row: rowNum, message: e?.message || String(e) });
      await prisma.eventImportJob.update({
        where: { id: jobId },
        data: {
          processedRows: i + 1,
          errorCount: errors.length,
          errors: errors as object,
        },
      });
    }
  }

  await prisma.eventImportJob.update({
    where: { id: jobId },
    data: {
      status: importedSummary.length === 0 ? "FAILED" : "COMPLETED",
      processedRows: rows.length,
      successCount: importedSummary.length,
      errorCount: errors.length,
      errors: errors as object,
      importedSummary: importedSummary as object,
    },
  });

  // Manual dispatch only (from Admin Events -> Mail tab).
  // await sendThankYouEmails(importedSummary);
}

async function sendThankYouEmails(
  importedSummary: { title: string; organizerEmail: string; organizerWasNew: boolean }[],
) {
  if (importedSummary.length === 0) return;

  const byEmail = new Map<string, { titles: string[]; wasNew: boolean }>();
  for (const item of importedSummary) {
    const cur = byEmail.get(item.organizerEmail) || { titles: [], wasNew: false };
    cur.titles.push(item.title);
    if (item.organizerWasNew) cur.wasNew = true;
    byEmail.set(item.organizerEmail, cur);
  }

  const base = FRONTEND_BASE.replace(/\/$/, "");

  for (const [email, { titles, wasNew }] of byEmail) {
    const user = await prisma.user.findFirst({
      where: { email, role: "ORGANIZER" },
      select: { id: true, firstName: true },
    });
    const firstName = user?.firstName || "there";

    let setPasswordUrl: string | undefined;
    if (wasNew && user) {
      const resetToken = randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });
      const encodedEmail = encodeURIComponent(email);
      setPasswordUrl = `${base}/reset-password?token=${resetToken}&email=${encodedEmail}`;
    }

    try {
      await sendEventImportThankYouEmail({
        toEmail: email,
        firstName,
        eventTitles: titles,
        setPasswordUrl,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[event-import] thank-you email failed", email, err);
    }
  }
}

export async function getImportJob(jobId: string) {
  const job = await prisma.eventImportJob.findUnique({ where: { id: jobId } });
  return job;
}
