"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGetEventsHandler = adminGetEventsHandler;
exports.adminGetEventStatsHandler = adminGetEventStatsHandler;
exports.adminGetEventByIdHandler = adminGetEventByIdHandler;
exports.adminVerifyEventHandler = adminVerifyEventHandler;
exports.adminUpdateEventHandler = adminUpdateEventHandler;
exports.adminDeleteEventHandler = adminDeleteEventHandler;
exports.adminApproveEventHandler = adminApproveEventHandler;
exports.adminRejectEventHandler = adminRejectEventHandler;
exports.adminGetVenuesHandler = adminGetVenuesHandler;
exports.adminGetVisitorsHandler = adminGetVisitorsHandler;
exports.adminGetDashboardHandler = adminGetDashboardHandler;
exports.adminGetEventCategoriesHandler = adminGetEventCategoriesHandler;
exports.adminGetEventMailCandidatesHandler = adminGetEventMailCandidatesHandler;
exports.adminSendEventListingEmailHandler = adminSendEventListingEmailHandler;
const admin_service_1 = require("./admin.service");
async function adminGetEventsHandler(req, res) {
    try {
        const page = req.query.page ? Number(req.query.page) : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const status = req.query.status ?? undefined;
        const search = req.query.search ?? undefined;
        const result = await (0, admin_service_1.adminListEvents)({ page, limit, status, search });
        return res.json({
            success: true,
            events: result.events,
            pagination: result.pagination,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin get events error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch events",
            details: error.message,
        });
    }
}
async function adminGetEventStatsHandler(_req, res) {
    try {
        const stats = await (0, admin_service_1.adminGetEventStats)();
        return res.json({
            success: true,
            stats: {
                total: stats.total,
                approved: stats.approved,
                rejected: stats.rejected,
                pending: stats.pending,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin get event stats error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event stats",
            details: error.message,
        });
    }
}
async function adminGetEventByIdHandler(req, res) {
    try {
        const { id } = req.params;
        const event = await (0, admin_service_1.adminGetEventById)(id);
        if (!event) {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: event,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin get event by id error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event",
            details: error.message,
        });
    }
}
async function adminVerifyEventHandler(req, res) {
    try {
        const { id } = req.params;
        const raw = req.body?.isVerified;
        const isVerified = raw === true ||
            raw === "true" ||
            String(raw ?? "").toLowerCase() === "true";
        const file = req.file;
        const verifiedBy = req.auth?.sub || req.auth?.email || "Admin";
        const result = await (0, admin_service_1.adminVerifyEvent)(id, {
            isVerified,
            badgeBuffer: file?.buffer,
            verifiedBy,
        });
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: result.event,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin verify event error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to update verification",
            details: error.message,
        });
    }
}
async function adminUpdateEventHandler(req, res) {
    try {
        const { id } = req.params;
        const body = { ...(req.body ?? {}) };
        // Map frontend names to Prisma fields (only these are written; venue/location/organizer are not)
        if (typeof body.featured === "boolean") {
            body.isFeatured = body.featured;
        }
        if (typeof body.vip === "boolean") {
            body.isVIP = body.vip;
        }
        if (body.layout !== undefined) {
            body.layoutPlan = body.layout;
        }
        if (body.maxCapacity !== undefined) {
            body.maxAttendees = body.maxCapacity;
        }
        if (body.isVerified === true && !body.verifiedBy && req.auth?.sub) {
            body.verifiedBy = req.auth.sub;
        }
        const result = await (0, admin_service_1.adminUpdateEvent)(id, body);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        if ("error" in result && result.error === "INVALID_YOUTUBE_URL") {
            return res.status(400).json({
                success: false,
                error: result.message ?? "Invalid YouTube URL",
            });
        }
        return res.json({
            success: true,
            data: result.event,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin update event error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to update event",
            details: error.message,
        });
    }
}
async function adminDeleteEventHandler(req, res) {
    try {
        const { id } = req.params;
        const result = await (0, admin_service_1.adminDeleteEvent)(id);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: { deleted: true },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin delete event error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to delete event",
            details: error.message,
        });
    }
}
async function adminApproveEventHandler(req, res) {
    try {
        const auth = req.auth;
        const { eventId } = req.body;
        if (!eventId) {
            return res.status(400).json({
                success: false,
                error: "eventId is required",
            });
        }
        const result = await (0, admin_service_1.adminApproveEvent)(eventId, auth.sub);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: result.event,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin approve event error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to approve event",
            details: error.message,
        });
    }
}
async function adminRejectEventHandler(req, res) {
    try {
        const auth = req.auth;
        const { eventId, reason } = req.body;
        if (!eventId) {
            return res.status(400).json({
                success: false,
                error: "eventId is required",
            });
        }
        const result = await (0, admin_service_1.adminRejectEvent)(eventId, auth.sub, reason);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: result.event,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin reject event error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to reject event",
            details: error.message,
        });
    }
}
async function adminGetVenuesHandler(_req, res) {
    try {
        const venues = await (0, admin_service_1.adminListVenues)();
        return res.json({
            success: true,
            data: {
                venues,
                total: venues.length,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin get venues error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch venues",
            details: error.message,
        });
    }
}
async function adminGetVisitorsHandler(_req, res) {
    try {
        const visitors = await (0, admin_service_1.adminListVisitors)();
        return res.json({
            success: true,
            data: {
                visitors,
                total: visitors.length,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin get visitors error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch visitors",
            details: error.message,
        });
    }
}
async function adminGetDashboardHandler(_req, res) {
    try {
        const summary = await (0, admin_service_1.adminGetDashboardSummary)();
        return res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin get dashboard error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch dashboard data",
            details: error.message,
        });
    }
}
async function adminGetEventCategoriesHandler(_req, res) {
    try {
        const categories = await (0, admin_service_1.adminListEventCategories)();
        return res.json(categories);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Admin get event categories error (backend):", error);
        return res.status(500).json([]);
    }
}
async function adminGetEventMailCandidatesHandler(_req, res) {
    try {
        const rows = await (0, admin_service_1.adminGetEventMailCandidates)();
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error("Admin get event mail candidates error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event mail candidates",
            details: error.message,
        });
    }
}
async function adminSendEventListingEmailHandler(req, res) {
    try {
        const organizerEmail = String(req.body?.organizerEmail ?? "").trim();
        const eventTitles = Array.isArray(req.body?.eventTitles)
            ? req.body.eventTitles.map((x) => String(x)).filter(Boolean)
            : [];
        if (!organizerEmail || eventTitles.length === 0) {
            return res.status(400).json({
                success: false,
                error: "organizerEmail and eventTitles are required",
            });
        }
        await (0, admin_service_1.adminSendEventListingEmail)({ organizerEmail, eventTitles });
        return res.json({ success: true, message: "Email sent" });
    }
    catch (error) {
        console.error("Admin send event listing email error (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to send email",
            details: error.message,
        });
    }
}
