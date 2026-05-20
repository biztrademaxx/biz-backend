"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminReportsOverview = getAdminReportsOverview;
exports.listReports = listReports;
const prisma_1 = __importDefault(require("../../../config/prisma"));
function monthKey(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/**
 * Aggregated metrics for admin Reports & Analytics (PostgreSQL via Prisma).
 */
async function getAdminReportsOverview() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
    const [eventsByStatus, eventsCreatedLast30Days, regGroups, usersByRole, usersJoinedLast30, totalRegistrations, confirmedRegistrations, messagesLast30, totalConnections, totalMessages, revenueAggregate, revByEventGroups, inactiveUsers, pendingApprovalEvents, reviewsTotal, savedEventsTotal, pendingDeactivations, speakersCount, exhibitorsCount, regsLast6Months,] = await Promise.all([
        prisma_1.default.event.groupBy({
            by: ["status"],
            _count: { id: true },
        }),
        prisma_1.default.event.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma_1.default.eventRegistration.groupBy({
            by: ["eventId"],
            where: { status: "CONFIRMED" },
            _count: { id: true },
        }),
        prisma_1.default.user.groupBy({
            by: ["role"],
            _count: { id: true },
        }),
        prisma_1.default.user.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma_1.default.eventRegistration.count(),
        prisma_1.default.eventRegistration.count({ where: { status: "CONFIRMED" } }),
        prisma_1.default.message.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma_1.default.connection.count(),
        prisma_1.default.message.count(),
        prisma_1.default.eventRegistration.aggregate({
            where: { status: "CONFIRMED" },
            _sum: { totalAmount: true },
            _count: { id: true },
        }),
        prisma_1.default.eventRegistration.groupBy({
            by: ["eventId"],
            where: { status: "CONFIRMED" },
            _sum: { totalAmount: true },
            _count: { id: true },
        }),
        prisma_1.default.user.count({ where: { isActive: false } }),
        prisma_1.default.event.count({ where: { status: "PENDING_APPROVAL" } }),
        prisma_1.default.review.count(),
        prisma_1.default.savedEvent.count(),
        prisma_1.default.accountDeactivationRequest.count({
            where: { status: "PENDING" },
        }),
        prisma_1.default.user.count({ where: { role: "SPEAKER" } }),
        prisma_1.default.user.count({ where: { role: "EXHIBITOR" } }),
        prisma_1.default.eventRegistration.findMany({
            where: {
                status: "CONFIRMED",
                registeredAt: { gte: sixMonthsAgo },
            },
            select: {
                registeredAt: true,
                totalAmount: true,
            },
        }),
    ]);
    const sortedRegs = [...regGroups].sort((a, b) => b._count.id - a._count.id).slice(0, 15);
    const topEventIds = sortedRegs.map((s) => s.eventId);
    const topEventsMeta = await prisma_1.default.event.findMany({
        where: { id: { in: topEventIds } },
        select: { id: true, title: true, status: true, startDate: true },
    });
    const eventMetaMap = new Map(topEventsMeta.map((e) => [e.id, e]));
    const topEventsByRegistrations = sortedRegs.map((s) => ({
        eventId: s.eventId,
        registrationCount: s._count.id,
        event: eventMetaMap.get(s.eventId) ?? null,
    }));
    const revSorted = [...revByEventGroups]
        .map((r) => ({
        eventId: r.eventId,
        revenue: r._sum.totalAmount ?? 0,
        orders: r._count.id,
    }))
        .filter((r) => r.revenue > 0 || r.orders > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 15);
    const revEventIds = revSorted.map((r) => r.eventId);
    const revEventsMeta = await prisma_1.default.event.findMany({
        where: { id: { in: revEventIds } },
        select: { id: true, title: true },
    });
    const revEventMap = new Map(revEventsMeta.map((e) => [e.id, e]));
    const revenueByEvent = revSorted.map((r) => ({
        ...r,
        event: revEventMap.get(r.eventId) ?? null,
    }));
    const monthlyTrend = {};
    for (const r of regsLast6Months) {
        const key = monthKey(r.registeredAt);
        if (!monthlyTrend[key])
            monthlyTrend[key] = { registrations: 0, revenue: 0 };
        monthlyTrend[key].registrations += 1;
        monthlyTrend[key].revenue += r.totalAmount ?? 0;
    }
    const monthlySeries = Object.entries(monthlyTrend)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v }));
    return {
        generatedAt: now.toISOString(),
        eventPerformance: {
            eventsByStatus: eventsByStatus.map((r) => ({
                status: String(r.status),
                count: r._count.id,
            })),
            eventsCreatedLast30Days,
            topEventsByRegistrations: topEventsByRegistrations.map((row) => ({
                eventId: row.eventId,
                registrationCount: row.registrationCount,
                title: row.event?.title ?? "Unknown event",
                status: row.event ? String(row.event.status) : null,
                startDate: row.event?.startDate?.toISOString() ?? null,
            })),
        },
        engagement: {
            usersByRole: usersByRole.map((r) => ({
                role: String(r.role),
                count: r._count.id,
            })),
            usersJoinedLast30Days: usersJoinedLast30,
            totalRegistrations,
            confirmedRegistrations,
            messagesLast30Days: messagesLast30,
            totalMessages,
            totalConnections,
            reviewsTotal,
            savedEventsTotal,
            speakersCount,
            exhibitorsCount,
        },
        revenue: {
            totalConfirmedRevenue: revenueAggregate._sum.totalAmount ?? 0,
            confirmedOrderCount: revenueAggregate._count.id,
            revenueByEvent,
            monthlySeriesLast6Months: monthlySeries,
        },
        systemHealth: {
            inactiveUsers,
            pendingApprovalEvents,
            pendingDeactivationRequests: pendingDeactivations,
            totalEvents: eventsByStatus.reduce((acc, r) => acc + r._count.id, 0),
        },
    };
}
async function listReports(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
}
