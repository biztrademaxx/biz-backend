"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateString = void 0;
exports.cleanPhone = cleanPhone;
exports.parseArray = parseArray;
exports.parseWorkbookToRows = parseWorkbookToRows;
exports.createImportJob = createImportJob;
exports.getImportJob = getImportJob;
/**
 * Bulk event import from CSV/TSV/XLSX — uses createEventAdmin + findOrCreateUser from events-writes.
 */
const crypto_1 = require("crypto");
const XLSX = __importStar(require("xlsx"));
const prisma_1 = __importDefault(require("../../../config/prisma"));
const youtube_url_1 = require("../../../utils/youtube-url");
const events_writes_service_1 = require("../../events/events-writes.service");
const email_service_1 = require("../../../services/email.service");
const event_import_parse_1 = require("./event-import-parse");
const event_import_row_1 = require("./event-import-row");
const event_import_dedupe_1 = require("./event-import-dedupe");
var event_import_parse_2 = require("./event-import-parse");
Object.defineProperty(exports, "parseDateString", { enumerable: true, get: function () { return event_import_parse_2.parseDateString; } });
const BATCH_PAUSE_MS = 5;
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function cleanPhone(phone) {
    if (phone === null || phone === undefined || phone === "")
        return undefined;
    const phoneStr = String(phone);
    if (phoneStr.startsWith("-"))
        return `+${phoneStr.substring(1)}`;
    const cleaned = phoneStr.replace(/[^\d+\-()]/g, "");
    return cleaned || undefined;
}
function parseArray(value, delimiter = ",") {
    if (value === null || value === undefined)
        return [];
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
function slugBase(s) {
    return s
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
}
async function ensureUniqueSlug(base) {
    let s = slugBase(base) || `event-${(0, crypto_1.randomBytes)(4).toString("hex")}`;
    let n = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const hit = await prisma_1.default.event.findUnique({ where: { slug: s } });
        if (!hit)
            return s;
        n += 1;
        s = `${slugBase(base) || "event"}-${n}`;
    }
}
function parseBool(v, defaultTrue = true) {
    if (v === null || v === undefined || v === "")
        return defaultTrue;
    return String(v).toLowerCase() === "true";
}
/** Prefer Excel display text (`.w`) so `01-08-2026` stays DD-MM, not Excel's internal MM/DD Date. */
function cellImportValue(cell) {
    if (!cell)
        return "";
    const displayed = cell.w != null ? String(cell.w).trim() : "";
    if (displayed && !displayed.includes("#"))
        return displayed;
    if (cell.v == null || cell.v === "")
        return "";
    if (typeof cell.v === "number" && cell.t === "n" && cell.z) {
        try {
            const formatted = XLSX.SSF.format(cell.z, cell.v);
            if (formatted && !formatted.includes("#"))
                return String(formatted).trim();
        }
        catch {
            /* fall through to raw serial */
        }
    }
    return cell.v;
}
function normalizeImportHeader(header) {
    return header.replace(/^\uFEFF/, "").trim();
}
function parseWorkbookToRows(buffer, _fileName) {
    const workbook = XLSX.read(buffer, {
        type: "buffer",
        cellDates: false,
        cellNF: true,
    });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"])
        return [];
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const headers = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
        headers.push(normalizeImportHeader(String(cellImportValue(sheet[addr]) || "")));
    }
    const rows = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const row = {};
        let hasData = false;
        for (let c = range.s.c; c <= range.e.c; c++) {
            const header = headers[c - range.s.c];
            if (!header)
                continue;
            const addr = XLSX.utils.encode_cell({ r, c });
            const value = cellImportValue(sheet[addr]);
            if (value !== "" && value != null)
                hasData = true;
            row[header] = value;
        }
        if (hasData)
            rows.push(row);
    }
    return rows;
}
async function resolveVenueFromRow(row) {
    const venueIdRaw = row.venueId ? String(row.venueId).trim() : "";
    const venueName = row.venueName ? String(row.venueName).trim() : "";
    const venueEmailRaw = row.venueEmail ? String(row.venueEmail).trim() : "";
    if (!venueIdRaw && !venueName && !venueEmailRaw)
        return null;
    if (venueIdRaw) {
        const byId = await prisma_1.default.user.findFirst({
            where: { id: venueIdRaw, role: "VENUE_MANAGER" },
            select: { id: true },
        });
        if (byId?.id)
            return byId.id;
    }
    if (venueEmailRaw) {
        const byEmail = await prisma_1.default.user.findFirst({
            where: { role: "VENUE_MANAGER", email: venueEmailRaw.toLowerCase() },
            select: { id: true },
        });
        if (byEmail?.id)
            return byEmail.id;
    }
    if (venueName) {
        const byName = await prisma_1.default.user.findFirst({
            where: { role: "VENUE_MANAGER", venueName: { equals: venueName, mode: "insensitive" } },
            select: { id: true },
        });
        if (byName?.id)
            return byName.id;
    }
    throw new Error(`Venue not found for provided identifier${venueName ? ` (name: ${venueName})` : ""}${venueEmailRaw ? ` (email: ${venueEmailRaw})` : ""}`);
}
function buildSpeakerSessions(row, start) {
    const emails = parseArray(row.speakerEmails, "|");
    if (emails.length === 0)
        return [];
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
function buildExhibitorBooths(row) {
    const emails = parseArray(row.exhibitorEmails, "|");
    if (emails.length === 0)
        return [];
    const names = parseArray(row.exhibitorNames, "|");
    return emails.map((email, i) => ({
        exhibitorEmail: email,
        exhibitorName: names[i] || `Exhibitor ${i + 1}`,
        company: names[i] || `Company ${i + 1}`,
        totalCost: 0,
        currency: "USD",
    }));
}
async function rowToEventBody(row, organizerId, venueId) {
    const title = String(row.eventTitle ?? "").trim();
    if (!title)
        throw new Error("eventTitle is required");
    const timeZone = (0, event_import_parse_1.parseImportTimezone)(row.timezone);
    const startDate = (0, event_import_parse_1.parseImportedDateTime)(row.startDate, row.startTime, "10:00", timeZone, "startDate");
    const endDate = (0, event_import_parse_1.parseImportedDateTime)(row.endDate || row.startDate, row.endTime, "18:00", timeZone, "endDate");
    const registrationStart = row.registrationStart
        ? (0, event_import_parse_1.parseImportedDateTime)(row.registrationStart, row.startTime, "10:00", timeZone, "registrationStart")
        : startDate;
    const registrationEnd = row.registrationEnd
        ? (0, event_import_parse_1.parseImportedDateTime)(row.registrationEnd, row.endTime, "18:00", timeZone, "registrationEnd")
        : endDate;
    const categories = [
        ...parseArray(row.category),
        ...parseArray(row.eventCategoryNames),
    ].filter(Boolean);
    const eventTypes = parseArray(row.eventType);
    const tags = parseArray(row.tags);
    const images = parseArray(row.images);
    const videos = parseArray(row.videos);
    const documents = parseArray(row.documents);
    let youtubeVideoUrl;
    if (videos.length > 0) {
        const yt = (0, youtube_url_1.normalizeYoutubeVideoUrlForStorage)(videos[0]);
        if (yt.ok && yt.value)
            youtubeVideoUrl = yt.value;
    }
    const slug = await ensureUniqueSlug(String(row.slug || row.eventSlug || row.eventTitle || "event"));
    const computedSubtitle = String(row.subTitle ?? row.eventSubTitle ?? row.shortDescription ?? title).trim();
    let metaDescription = row.metaDescription ? String(row.metaDescription) : "";
    const countries = parseArray(row.countryNames);
    const cities = parseArray(row.cityNames);
    if (countries.length)
        metaDescription = [metaDescription, `Countries: ${countries.join(", ")}`].filter(Boolean).join(" | ");
    if (cities.length)
        metaDescription = [metaDescription, `Cities: ${cities.join(", ")}`].filter(Boolean).join(" | ");
    const body = {
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
        timezone: timeZone,
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
    if (youtubeVideoUrl)
        body.youtubeVideoUrl = youtubeVideoUrl;
    return body;
}
async function createImportJob(params) {
    const rows = parseWorkbookToRows(params.buffer, params.fileName);
    if (rows.length === 0) {
        throw new Error("No data rows found in file");
    }
    const job = await prisma_1.default.eventImportJob.create({
        data: {
            status: "PENDING",
            fileName: params.fileName,
            totalRows: rows.length,
            rowsPayload: rows,
            createdByAdminId: params.createdByAdminId,
            createdByAdminRole: params.createdByAdminRole ?? "SUPER_ADMIN",
        },
    });
    void runImportJob(job.id).catch((e) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars no-console 
        console.error("[event-import] job failed", job.id, e);
    });
    return { jobId: job.id };
}
async function runImportJob(jobId) {
    const job = await prisma_1.default.eventImportJob.findUnique({ where: { id: jobId } });
    if (!job || !job.rowsPayload)
        return;
    await prisma_1.default.eventImportJob.update({
        where: { id: jobId },
        data: { status: "PROCESSING", processedRows: 0 },
    });
    const rows = job.rowsPayload.map((r) => (0, event_import_row_1.normalizeImportRow)(r));
    const errors = [];
    const importedSummary = [];
    const adminId = job.createdByAdminId || "00000000-0000-0000-0000-000000000000";
    const adminType = job.createdByAdminRole === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN";
    const seenDuplicateKeys = new Set();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
            const dupFp = (0, event_import_dedupe_1.buildImportDuplicateFingerprint)(row);
            if (!dupFp.titleNorm) {
                throw new Error("eventTitle is required");
            }
            const dupKey = (0, event_import_dedupe_1.duplicateKeyFromFingerprint)(dupFp);
            if (seenDuplicateKeys.has(dupKey)) {
                throw new Error((0, event_import_dedupe_1.duplicateSkipMessage)(dupFp, "spreadsheet"));
            }
            if (await (0, event_import_dedupe_1.findExistingEventDuplicate)(dupFp)) {
                throw new Error((0, event_import_dedupe_1.duplicateSkipMessage)(dupFp, "database"));
            }
            const orgEmailRaw = String(row.organizerEmail ?? "").trim().toLowerCase();
            const orgName = String(row.organizerName ?? "").trim();
            let organizer;
            let organizerWasNew = false;
            if (orgEmailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgEmailRaw)) {
                const first = (orgName || "Organizer").split(" ")[0] || "Organizer";
                const last = (orgName || "Organizer").split(" ").slice(1).join(" ") || "";
                const out = await (0, events_writes_service_1.findOrCreateUser)({
                    email: orgEmailRaw,
                    role: "ORGANIZER",
                    firstName: first,
                    lastName: last,
                });
                organizer = { id: out.user.id, email: out.user.email ?? orgEmailRaw };
                organizerWasNew = out.created;
            }
            else if (orgName) {
                const syntheticEmail = `organizer-${slugBase(orgName)}-${(0, crypto_1.randomBytes)(3).toString("hex")}@import.local`;
                const existingByName = await prisma_1.default.user.findFirst({
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
                }
                else {
                    const first = orgName.split(" ")[0] || "Organizer";
                    const last = orgName.split(" ").slice(1).join(" ") || "";
                    const out = await (0, events_writes_service_1.findOrCreateUser)({
                        email: syntheticEmail,
                        role: "ORGANIZER",
                        firstName: first,
                        lastName: last,
                        company: orgName,
                    });
                    organizer = { id: out.user.id, email: out.user.email ?? syntheticEmail };
                    organizerWasNew = out.created;
                }
            }
            else {
                throw new Error("Provide organizerEmail or organizerName");
            }
            let venueId = null;
            try {
                venueId = await resolveVenueFromRow(row);
            }
            catch (ve) {
                // eslint-disable-next-line no-console
                console.warn(`[event-import] row ${rowNum} venue skipped:`, ve?.message);
            }
            const body = await rowToEventBody(row, organizer.id, venueId);
            body.organizerId = organizer.id;
            const result = await (0, events_writes_service_1.createEventAdmin)({
                body,
                adminId,
                adminType,
            });
            if ("error" in result) {
                throw new Error(result.error === "MISSING_FIELDS"
                    ? `Missing: ${result.missing?.join(", ")}`
                    : String(result.error));
            }
            const title = String(row.eventTitle ?? "").trim();
            importedSummary.push({
                title,
                organizerEmail: organizer.email,
                organizerWasNew: organizerWasNew,
            });
            seenDuplicateKeys.add(dupKey);
            await prisma_1.default.eventImportJob.update({
                where: { id: jobId },
                data: {
                    processedRows: i + 1,
                    successCount: importedSummary.length,
                    importedSummary: importedSummary,
                    errors: errors.length ? errors : undefined,
                },
            });
            if (i % 20 === 0)
                await sleep(BATCH_PAUSE_MS);
        }
        catch (e) {
            errors.push({ row: rowNum, message: e?.message || String(e) });
            await prisma_1.default.eventImportJob.update({
                where: { id: jobId },
                data: {
                    processedRows: i + 1,
                    errorCount: errors.length,
                    errors: errors,
                },
            });
        }
    }
    await prisma_1.default.eventImportJob.update({
        where: { id: jobId },
        data: {
            status: importedSummary.length === 0 ? "FAILED" : "COMPLETED",
            processedRows: rows.length,
            successCount: importedSummary.length,
            errorCount: errors.length,
            errors: errors,
            importedSummary: importedSummary,
        },
    });
    // Manual dispatch only (from Admin Events -> Mail tab).
    // await sendThankYouEmails(importedSummary);
}
async function sendThankYouEmails(importedSummary) {
    if (importedSummary.length === 0)
        return;
    const byEmail = new Map();
    for (const item of importedSummary) {
        const cur = byEmail.get(item.organizerEmail) || { titles: [], wasNew: false };
        cur.titles.push(item.title);
        if (item.organizerWasNew)
            cur.wasNew = true;
        byEmail.set(item.organizerEmail, cur);
    }
    const base = email_service_1.FRONTEND_BASE.replace(/\/$/, "");
    for (const [email, { titles, wasNew }] of byEmail) {
        const user = await prisma_1.default.user.findFirst({
            where: { email, role: "ORGANIZER" },
            select: { id: true, firstName: true },
        });
        const firstName = user?.firstName || "there";
        let setPasswordUrl;
        if (wasNew && user) {
            const resetToken = (0, crypto_1.randomBytes)(32).toString("hex");
            const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await prisma_1.default.user.update({
                where: { id: user.id },
                data: { resetToken, resetTokenExpiry },
            });
            const encodedEmail = encodeURIComponent(email);
            setPasswordUrl = `${base}/reset-password?token=${resetToken}&email=${encodedEmail}`;
        }
        try {
            await (0, email_service_1.sendEventImportThankYouEmail)({
                toEmail: email,
                firstName,
                eventTitles: titles,
                setPasswordUrl,
            });
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error("[event-import] thank-you email failed", email, err);
        }
    }
}
async function getImportJob(jobId) {
    const job = await prisma_1.default.eventImportJob.findUnique({ where: { id: jobId } });
    return job;
}
