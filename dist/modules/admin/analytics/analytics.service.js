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
function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatDay(d) {
    return d.toISOString().slice(0, 10);
}
function startOfWeek(d) {
    const day = d.getDay();
    const diff = (day + 6) % 7; // monday-based
    const out = new Date(d);
    out.setDate(out.getDate() - diff);
    out.setHours(0, 0, 0, 0);
    return out;
}
function formatWeek(d) {
    return `${formatDay(startOfWeek(d))}`;
}
function formatMonth(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function classify(log) {
    const a = String(log.action || "").toUpperCase();
    const r = String(log.resource || "").toUpperCase();
    if (a.includes("EVENT_BULK_IMPORT") || r === "EVENT_IMPORT")
        return "bulkImports";
    if (a.includes("EVENT_CREATED") || r === "EVENT")
        return "events";
    if (a.includes("ORGANIZER_CREATED") || r === "ORGANIZER")
        return "organizers";
    if (a.includes("EXHIBITOR_CREATED") || r === "EXHIBITOR")
        return "exhibitors";
    if (a.includes("SPEAKER_CREATED") || r === "SPEAKER")
        return "speakers";
    return null;
}
function createBucket() {
    return { period: "", events: 0, organizers: 0, exhibitors: 0, speakers: 0, bulkImports: 0, total: 0 };
}
async function getSubAdminActivityAnalytics(params) {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const where = {
        adminType: "SUB_ADMIN",
        createdAt: { gte: since },
        action: {
            in: [
                "EVENT_CREATED",
                "ADMIN_ORGANIZER_CREATED",
                "ADMIN_EXHIBITOR_CREATED",
                "ADMIN_SPEAKER_CREATED",
                "ADMIN_EVENT_BULK_IMPORT_STARTED",
            ],
        },
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
    const totals = createBucket();
    for (const admin of subAdmins) {
        bySubAdmin.set(admin.id, {
            adminId: admin.id,
            name: admin.name || "Sub Admin",
            email: admin.email || "",
            isActive: admin.isActive,
            lastLogin: admin.lastLogin ? admin.lastLogin.toISOString() : null,
            lastActivityAt: null,
            onlineStatus: "OFFLINE",
            events: 0,
            organizers: 0,
            exhibitors: 0,
            speakers: 0,
            bulkImports: 0,
            total: 0,
        });
    }
    for (const log of logs) {
        const key = classify(log);
        if (!key)
            continue;
        const when = new Date(log.createdAt);
        const dayKey = formatDay(startOfDay(when));
        const weekKey = formatWeek(when);
        const monthKey = formatMonth(when);
        const d = daily.get(dayKey) ?? { ...createBucket(), period: dayKey };
        d[key] += 1;
        d.total += 1;
        daily.set(dayKey, d);
        const w = weekly.get(weekKey) ?? { ...createBucket(), period: weekKey };
        w[key] += 1;
        w.total += 1;
        weekly.set(weekKey, w);
        const m = monthly.get(monthKey) ?? { ...createBucket(), period: monthKey };
        m[key] += 1;
        m.total += 1;
        monthly.set(monthKey, m);
        totals[key] += 1;
        totals.total += 1;
        if (key === "events" && log.resourceId)
            eventIds.push(log.resourceId);
        const existingLast = lastActivityByAdmin.get(log.adminId);
        if (!existingLast || when > existingLast) {
            lastActivityByAdmin.set(log.adminId, when);
        }
        const sub = bySubAdmin.get(log.adminId) ?? {
            adminId: log.adminId,
            name: subAdminMap.get(log.adminId)?.name ?? "Unknown",
            email: subAdminMap.get(log.adminId)?.email ?? "",
            isActive: subAdminMap.get(log.adminId)?.isActive ?? false,
            lastLogin: subAdminMap.get(log.adminId)?.lastLogin?.toISOString() ?? null,
            lastActivityAt: null,
            onlineStatus: "OFFLINE",
            events: 0,
            organizers: 0,
            exhibitors: 0,
            speakers: 0,
            bulkImports: 0,
            total: 0,
        };
        sub[key] += 1;
        sub.total += 1;
        bySubAdmin.set(log.adminId, sub);
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
        totals,
        daily: Array.from(daily.values()),
        weekly: Array.from(weekly.values()),
        monthly: Array.from(monthly.values()),
        eventCountries,
        bySubAdmin: Array.from(bySubAdmin.values()).sort((a, b) => b.total - a.total),
    };
}
