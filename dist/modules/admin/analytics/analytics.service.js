"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventsGrowth = getEventsGrowth;
exports.getUserGrowth = getUserGrowth;
exports.getRevenue = getRevenue;
exports.getSubAdminActivityAnalytics = getSubAdminActivityAnalytics;
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function getEventsGrowth() {
    const total = await prisma_1.default.event.count();
    const published = await prisma_1.default.event.count({ where: { status: "PUBLISHED" } });
    return { data: [], total, published };
}
async function getUserGrowth() {
    const total = await prisma_1.default.user.count();
    const byRole = await prisma_1.default.user.groupBy({
        by: ["role"],
        _count: { id: true },
    });
    return { data: byRole.map((r) => ({ role: r.role, count: r._count.id })), total };
}
async function getRevenue() {
    return { total: 0, byEvent: [], byMonth: [] };
}
const CREATED_ACTIONS = [
    "EVENT_CREATED",
    "ADMIN_ORGANIZER_CREATED",
    "ADMIN_EXHIBITOR_CREATED",
    "ADMIN_SPEAKER_CREATED",
    "ADMIN_EVENT_BULK_IMPORT_STARTED",
    "ADMIN_EVENT_BULK_IMPORT_COMPLETED",
    "ADMIN_ORGANIZER_BULK_IMPORTED",
    "ADMIN_VENUE_BULK_IMPORTED",
];
const UPDATED_ACTIONS = [
    "EVENT_UPDATED",
    "ADMIN_ORGANIZER_UPDATED",
    "ADMIN_EXHIBITOR_UPDATED",
    "ADMIN_SPEAKER_UPDATED",
    "ADMIN_ORGANIZER_BULK_UPDATED",
];
/** Calendar bucketing timezone (en-CA yields YYYY-MM-DD). */
const ANALYTICS_TIMEZONE = process.env.ADMIN_ANALYTICS_TIMEZONE ?? "Asia/Kolkata";
function formatDay(d) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: ANALYTICS_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}
function startOfWeek(d) {
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const out = new Date(d);
    out.setDate(out.getDate() - diff);
    out.setHours(0, 0, 0, 0);
    return out;
}
function formatWeek(d) {
    return formatDay(startOfWeek(d));
}
function formatMonth(d) {
    return formatDay(d).slice(0, 7);
}
function emptyCounts() {
    return { events: 0, organizers: 0, exhibitors: 0, speakers: 0, bulkImports: 0, total: 0 };
}
function emptyUpdatedSlice() {
    return {
        eventsUpdated: 0,
        organizersUpdated: 0,
        exhibitorsUpdated: 0,
        speakersUpdated: 0,
        bulkImportsUpdated: 0,
        totalUpdated: 0,
    };
}
function createBucket(period = "") {
    return { ...emptyCounts(), ...emptyUpdatedSlice(), period };
}
function parseLogDetails(details) {
    if (details && typeof details === "object" && !Array.isArray(details)) {
        return details;
    }
    return null;
}
function positiveInt(value, fallback = 1) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
/** Excel / bulk uploads may produce multiple created metrics per log row. */
function classifyCreatedEntries(log) {
    const a = String(log.action || "").toUpperCase();
    const r = String(log.resource || "").toUpperCase();
    const details = parseLogDetails(log.details);
    const entries = [];
    if (a === "ADMIN_ORGANIZER_BULK_IMPORTED") {
        const created = positiveInt(details?.createdCount, 0);
        if (created > 0)
            entries.push({ key: "organizers", count: created });
        entries.push({ key: "bulkImports", count: 1 });
        return entries;
    }
    if (a.includes("VENUE_BULK_IMPORTED")) {
        entries.push({ key: "bulkImports", count: positiveInt(details?.createdCount ?? details?.successCount, 1) });
        return entries;
    }
    if (a.includes("EVENT_BULK_IMPORT") || r === "EVENT_IMPORT") {
        entries.push({ key: "bulkImports", count: 1 });
        return entries;
    }
    if (a === "EVENT_CREATED" || a.includes("EVENT_CREATED")) {
        entries.push({ key: "events", count: 1 });
        return entries;
    }
    if (a.includes("ORGANIZER_CREATED") || (r === "ORGANIZER" && !a.includes("BULK"))) {
        entries.push({ key: "organizers", count: 1 });
        return entries;
    }
    if (a.includes("EXHIBITOR_CREATED") || r === "EXHIBITOR") {
        entries.push({ key: "exhibitors", count: 1 });
        return entries;
    }
    if (a.includes("SPEAKER_CREATED") || r === "SPEAKER") {
        entries.push({ key: "speakers", count: 1 });
        return entries;
    }
    return entries;
}
function classifyUpdatedEntries(log) {
    const a = String(log.action || "").toUpperCase();
    const r = String(log.resource || "").toUpperCase();
    const details = parseLogDetails(log.details);
    if (a === "ADMIN_ORGANIZER_BULK_UPDATED" || (a.includes("ORGANIZER_BULK") && a.includes("UPDATED"))) {
        const n = positiveInt(details?.updatedCount ?? details?.count, 1);
        return [
            { key: "organizers", count: n },
            { key: "bulkImports", count: n },
        ];
    }
    if (a.includes("EVENT_UPDATED") || (a.includes("UPDATED") && r === "EVENT")) {
        return [{ key: "events", count: 1 }];
    }
    if (a.includes("ORGANIZER_UPDATED") || (a.includes("UPDATED") && r === "ORGANIZER" && !a.includes("BULK"))) {
        return [{ key: "organizers", count: 1 }];
    }
    if (a.includes("EXHIBITOR_UPDATED") || (a.includes("UPDATED") && r === "EXHIBITOR")) {
        return [{ key: "exhibitors", count: 1 }];
    }
    if (a.includes("SPEAKER_UPDATED") || (a.includes("UPDATED") && r === "SPEAKER")) {
        return [{ key: "speakers", count: 1 }];
    }
    return [];
}
function applyCreated(bucket, key, count) {
    bucket[key] += count;
    bucket.total += count;
}
function applyUpdatedKey(target, key, count) {
    if (key === "events")
        target.eventsUpdated += count;
    else if (key === "organizers")
        target.organizersUpdated += count;
    else if (key === "exhibitors")
        target.exhibitorsUpdated += count;
    else if (key === "speakers")
        target.speakersUpdated += count;
    else if (key === "bulkImports")
        target.bulkImportsUpdated += count;
}
function applyUpdatedEntries(target, entries) {
    if (entries.length === 0)
        return;
    let totalAdd = 0;
    for (const entry of entries) {
        applyUpdatedKey(target, entry.key, entry.count);
        totalAdd = Math.max(totalAdd, entry.count);
    }
    target.totalUpdated += totalAdd;
}
function initSubAdminRow(admin) {
    return {
        adminId: admin.id,
        name: admin.name || "Sub Admin",
        email: admin.email || "",
        isActive: admin.isActive,
        lastLogin: admin.lastLogin ? admin.lastLogin.toISOString() : null,
        lastActivityAt: null,
        onlineStatus: "OFFLINE",
        ...emptyCounts(),
        ...emptyUpdatedSlice(),
    };
}
async function getSubAdminActivityAnalytics(params) {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const where = {
        adminType: "SUB_ADMIN",
        createdAt: { gte: since },
        OR: [
            { action: { in: [...CREATED_ACTIONS] } },
            { action: { in: [...UPDATED_ACTIONS] } },
        ],
    };
    if (params.adminId)
        where.adminId = params.adminId;
    const logs = await prisma_1.default.adminLog.findMany({
        where,
        orderBy: { createdAt: "asc" },
        select: {
            adminId: true,
            action: true,
            resource: true,
            resourceId: true,
            details: true,
            createdAt: true,
        },
    });
    const subAdmins = await prisma_1.default.subAdmin.findMany({
        where: params.adminId ? { id: params.adminId } : undefined,
        select: { id: true, name: true, email: true, isActive: true, lastLogin: true },
    });
    const subAdminMap = new Map(subAdmins.map((s) => [s.id, s]));
    const daily = new Map();
    const weekly = new Map();
    const monthly = new Map();
    const bySubAdmin = new Map();
    const lastActivityByAdmin = new Map();
    const eventIds = [];
    const totalsCreated = emptyCounts();
    const totalsUpdated = emptyUpdatedSlice();
    for (const admin of subAdmins) {
        bySubAdmin.set(admin.id, initSubAdminRow(admin));
    }
    for (const log of logs) {
        const when = new Date(log.createdAt);
        const dayKey = formatDay(when);
        const weekKey = formatWeek(when);
        const monthKey = formatMonth(when);
        const bumpActivity = () => {
            const existingLast = lastActivityByAdmin.get(log.adminId);
            if (!existingLast || when > existingLast) {
                lastActivityByAdmin.set(log.adminId, when);
            }
        };
        const createdEntries = classifyCreatedEntries(log);
        if (createdEntries.length > 0) {
            bumpActivity();
            for (const entry of createdEntries) {
                const d = daily.get(dayKey) ?? createBucket(dayKey);
                applyCreated(d, entry.key, entry.count);
                daily.set(dayKey, d);
                const w = weekly.get(weekKey) ?? createBucket(weekKey);
                applyCreated(w, entry.key, entry.count);
                weekly.set(weekKey, w);
                const m = monthly.get(monthKey) ?? createBucket(monthKey);
                applyCreated(m, entry.key, entry.count);
                monthly.set(monthKey, m);
                applyCreated(totalsCreated, entry.key, entry.count);
                if (entry.key === "events" && log.resourceId)
                    eventIds.push(log.resourceId);
                const sub = bySubAdmin.get(log.adminId) ??
                    initSubAdminRow({
                        id: log.adminId,
                        name: subAdminMap.get(log.adminId)?.name ?? null,
                        email: subAdminMap.get(log.adminId)?.email ?? null,
                        isActive: subAdminMap.get(log.adminId)?.isActive ?? false,
                        lastLogin: subAdminMap.get(log.adminId)?.lastLogin ?? null,
                    });
                applyCreated(sub, entry.key, entry.count);
                bySubAdmin.set(log.adminId, sub);
            }
        }
        const updatedEntries = classifyUpdatedEntries(log);
        if (updatedEntries.length > 0) {
            bumpActivity();
            const d = daily.get(dayKey) ?? createBucket(dayKey);
            const w = weekly.get(weekKey) ?? createBucket(weekKey);
            const m = monthly.get(monthKey) ?? createBucket(monthKey);
            const sub = bySubAdmin.get(log.adminId) ??
                initSubAdminRow({
                    id: log.adminId,
                    name: subAdminMap.get(log.adminId)?.name ?? null,
                    email: subAdminMap.get(log.adminId)?.email ?? null,
                    isActive: subAdminMap.get(log.adminId)?.isActive ?? false,
                    lastLogin: subAdminMap.get(log.adminId)?.lastLogin ?? null,
                });
            applyUpdatedEntries(d, updatedEntries);
            applyUpdatedEntries(w, updatedEntries);
            applyUpdatedEntries(m, updatedEntries);
            applyUpdatedEntries(totalsUpdated, updatedEntries);
            applyUpdatedEntries(sub, updatedEntries);
            daily.set(dayKey, d);
            weekly.set(weekKey, w);
            monthly.set(monthKey, m);
            bySubAdmin.set(log.adminId, sub);
        }
    }
    const ONLINE_WINDOW_MS = 15 * 60 * 1000;
    const now = Date.now();
    for (const [adminId, row] of bySubAdmin.entries()) {
        const lastActivity = lastActivityByAdmin.get(adminId);
        const lastLoginDate = row.lastLogin ? new Date(row.lastLogin) : null;
        const lastSeenMs = Math.max(lastActivity?.getTime() ?? 0, lastLoginDate?.getTime() ?? 0);
        const online = row.isActive && lastSeenMs > 0 && now - lastSeenMs <= ONLINE_WINDOW_MS;
        row.lastActivityAt = lastActivity ? lastActivity.toISOString() : null;
        row.onlineStatus = online ? "ONLINE" : "OFFLINE";
        bySubAdmin.set(adminId, row);
    }
    const uniqueEventIds = Array.from(new Set(eventIds));
    let eventCountries = [];
    if (uniqueEventIds.length > 0) {
        const events = await prisma_1.default.event.findMany({
            where: { id: { in: uniqueEventIds } },
            select: {
                id: true,
                venue: {
                    select: {
                        venueCountry: true,
                    },
                },
            },
        });
        const countryMap = new Map();
        for (const event of events) {
            const raw = event.venue?.venueCountry?.trim() || "Unknown";
            const country = raw.length > 0 ? raw : "Unknown";
            countryMap.set(country, (countryMap.get(country) ?? 0) + 1);
        }
        eventCountries = Array.from(countryMap.entries())
            .map(([country, eventsCount]) => ({ country, events: eventsCount }))
            .sort((a, b) => b.events - a.events);
    }
    return {
        generatedAt: new Date().toISOString(),
        scope: params.adminId ? "self" : "all-sub-admins",
        totals: totalsCreated,
        totalsUpdated,
        daily: Array.from(daily.values()),
        weekly: Array.from(weekly.values()),
        monthly: Array.from(monthly.values()),
        eventCountries,
        bySubAdmin: Array.from(bySubAdmin.values()).sort((a, b) => b.total + b.totalUpdated - (a.total + a.totalUpdated)),
    };
}
