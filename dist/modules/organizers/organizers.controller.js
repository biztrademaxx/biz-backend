"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganizersHandler = getOrganizersHandler;
exports.getOrganizerHandler = getOrganizerHandler;
exports.updateOrganizerProfileHandler = updateOrganizerProfileHandler;
exports.getOrganizerAnalyticsHandler = getOrganizerAnalyticsHandler;
exports.getOrganizerTotalAttendeesHandler = getOrganizerTotalAttendeesHandler;
exports.getOrganizerEventsHandler = getOrganizerEventsHandler;
exports.updateOrganizerEventHandler = updateOrganizerEventHandler;
exports.deleteOrganizerEventHandler = deleteOrganizerEventHandler;
exports.createOrganizerEventHandler = createOrganizerEventHandler;
exports.getOrganizerMessagesHandler = getOrganizerMessagesHandler;
exports.createOrganizerMessageHandler = createOrganizerMessageHandler;
exports.deleteOrganizerMessageHandler = deleteOrganizerMessageHandler;
exports.getOrganizerConnectionsHandler = getOrganizerConnectionsHandler;
exports.getOrganizerLeadsHandler = getOrganizerLeadsHandler;
exports.getOrganizerExhibitorLeadsHandler = getOrganizerExhibitorLeadsHandler;
exports.getOrganizerAttendeeLeadsHandler = getOrganizerAttendeeLeadsHandler;
exports.getOrganizerPromotionsHandler = getOrganizerPromotionsHandler;
exports.createOrganizerPromotionHandler = createOrganizerPromotionHandler;
exports.getOrganizerSubscriptionHandler = getOrganizerSubscriptionHandler;
exports.updateOrganizerSubscriptionHandler = updateOrganizerSubscriptionHandler;
exports.getOrganizerReviewsHandler = getOrganizerReviewsHandler;
exports.createOrganizerReviewHandler = createOrganizerReviewHandler;
const organizers_service_1 = require("./organizers.service");
const prisma_1 = __importDefault(require("../../config/prisma"));
const events_service_1 = require("../events/events.service");
const events_writes_service_1 = require("../events/events-writes.service");
async function getOrganizersHandler(req, res) {
    try {
        const requireProfileImage = req.query.requireProfileImage === "1" || req.query.requireProfileImage === "true";
        const organizers = await (0, organizers_service_1.listOrganizers)({ requireProfileImage });
        return res.json({
            organizers,
            total: organizers.length,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizers (backend):", error);
        return res.status(500).json({
            error: "Internal server error",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function getOrganizerHandler(req, res) {
    try {
        const { id } = req.params;
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const organizer = await (0, organizers_service_1.getOrganizerById)(id, viewerId);
        if (!organizer) {
            // Expired JWT + private/inactive profile looks like 404; apiFetch only retries on 401.
            if (req.hadInvalidAuthToken) {
                const row = await prisma_1.default.user.findFirst({
                    where: { id, role: "ORGANIZER" },
                    select: { profileVisibility: true, isActive: true },
                });
                if (row && (!row.isActive || row.profileVisibility === "private")) {
                    return res.status(401).json({ message: "Invalid or expired token" });
                }
            }
            return res.status(404).json({ error: "Organizer not found" });
        }
        return res.json({ organizer });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function updateOrganizerProfileHandler(req, res) {
    try {
        const auth = req.auth;
        const { id } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({ error: "Invalid organizer ID" });
        }
        if (!auth || (auth.sub !== id && auth.role !== "ORGANIZER")) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const updated = await (0, organizers_service_1.updateOrganizerProfile)(id, req.body ?? {});
        if (!updated) {
            return res.status(404).json({ error: "Organizer not found" });
        }
        return res.json({ organizer: updated });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error updating organizer (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getOrganizerAnalyticsHandler(req, res) {
    try {
        const { id } = req.params;
        const analytics = await (0, organizers_service_1.getOrganizerAnalytics)(id);
        if (!analytics) {
            return res.status(404).json({ error: "Organizer not found" });
        }
        return res.json({ analytics });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer analytics (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getOrganizerTotalAttendeesHandler(req, res) {
    try {
        const { id } = req.params;
        const data = await (0, organizers_service_1.getOrganizerTotalAttendees)(id);
        return res.json(data);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer total attendees (backend):", error);
        return res.status(500).json({
            error: "Failed to fetch total attendees",
            details: error.message,
        });
    }
}
async function getOrganizerEventsHandler(req, res) {
    try {
        const { id } = req.params;
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const result = await (0, organizers_service_1.listOrganizerEvents)(id, page, limit, viewerId);
        // Same as getOrganizer: owner with expired token would get an empty list without a chance to refresh.
        if (req.hadInvalidAuthToken &&
            result.events.length === 0 &&
            result.pagination.total === 0) {
            const row = await prisma_1.default.user.findFirst({
                where: { id, role: "ORGANIZER" },
                select: { profileVisibility: true, isActive: true },
            });
            if (row && (!row.isActive || row.profileVisibility === "private")) {
                return res.status(401).json({ message: "Invalid or expired token" });
            }
        }
        return res.json({
            success: true,
            events: result.events,
            pagination: result.pagination,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer events (backend):", error);
        if (error instanceof Error && error.message.includes("Organizer ID is required")) {
            return res.status(400).json({ success: false, error: "Organizer ID is required" });
        }
        return res.status(500).json({ success: false, error: "Failed to fetch organizer events" });
    }
}
async function updateOrganizerEventHandler(req, res) {
    try {
        const auth = req.auth;
        const { id, eventId } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({ error: "Invalid organizer ID" });
        }
        if (!eventId) {
            return res.status(400).json({ error: "Event ID is required" });
        }
        if (auth.sub !== id && auth.role !== "ORGANIZER") {
            return res.status(403).json({ error: "Forbidden" });
        }
        const result = await (0, events_service_1.updateEventByOrganizer)(id, eventId, req.body);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({ error: "Event not found or access denied" });
        }
        return res.status(200).json({
            message: "Event updated successfully",
            event: result.event,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Update organizer event error (backend):", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function deleteOrganizerEventHandler(req, res) {
    try {
        const auth = req.auth;
        const { id, eventId } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({ error: "Invalid organizer ID" });
        }
        if (!eventId) {
            return res.status(400).json({ error: "Event ID is required" });
        }
        if (auth.sub !== id && auth.role !== "ORGANIZER") {
            return res.status(403).json({ error: "Forbidden" });
        }
        const result = await (0, events_service_1.deleteEventByOrganizer)(id, eventId);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({ error: "Event not found or access denied" });
        }
        return res.status(200).json({ message: "Event deleted successfully" });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Delete organizer event error (backend):", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function createOrganizerEventHandler(req, res) {
    try {
        const auth = req.auth;
        const { id } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({ error: "Invalid organizer ID" });
        }
        // When called from the organizer Next.js dashboard we may not have
        // backend JWT auth (req.auth undefined). In that case, allow the
        // organizer to submit an event for approval based solely on the
        // path param id and rely on the admin approval flow to gate publish.
        if (auth && (auth.sub !== id || auth.role !== "ORGANIZER")) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const body = {
            ...req.body,
            organizerId: id,
            status: "PENDING_APPROVAL",
        };
        const result = await (0, events_writes_service_1.createEventAdmin)({
            body,
            adminId: auth?.sub ?? id,
            adminType: auth?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "SUB_ADMIN",
            ipAddress: req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress,
            userAgent: req.headers["user-agent"],
        });
        if ("error" in result) {
            if (result.error === "MISSING_FIELDS") {
                return res.status(400).json({
                    error: `Missing required fields: ${(result.missing ?? []).join(", ")}`,
                });
            }
            if (result.error === "ORGANIZER_REQUIRED") {
                return res.status(400).json({
                    error: "organizerId or organizerEmail/organizerName is required",
                });
            }
            return res.status(400).json({ error: "Bad request" });
        }
        return res.status(201).json({
            success: result.success,
            message: result.message,
            event: result.event,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Create organizer event error (backend):", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
// ---------- Organizer messages ----------
async function getOrganizerMessagesHandler(req, res) {
    try {
        const { id } = req.params;
        const data = await (0, organizers_service_1.listOrganizerMessages)(id);
        if (!data) {
            return res.status(404).json({
                success: false,
                error: "Organizer not found",
            });
        }
        return res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer messages (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch organizer messages",
            details: error.message,
        });
    }
}
async function createOrganizerMessageHandler(req, res) {
    try {
        const auth = req.auth;
        const { id } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({
                success: false,
                error: "Invalid organizer ID",
            });
        }
        if (auth.sub !== id && auth.role !== "ORGANIZER") {
            return res.status(403).json({
                success: false,
                error: "Forbidden",
            });
        }
        const body = req.body;
        if (!body.content || typeof body.content !== "string") {
            return res.status(400).json({
                success: false,
                error: "Message content is required",
            });
        }
        const result = await (0, organizers_service_1.createOrganizerMessage)(id, body);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                error: "Organizer not found",
            });
        }
        return res.status(201).json({
            success: true,
            data: result.message,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating organizer message (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to create message",
            details: error.message,
        });
    }
}
async function deleteOrganizerMessageHandler(req, res) {
    try {
        const auth = req.auth;
        const { id, messageId } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({
                success: false,
                error: "Invalid organizer ID",
            });
        }
        if (!messageId) {
            return res.status(400).json({
                success: false,
                error: "Message ID is required",
            });
        }
        if (auth.sub !== id && auth.role !== "ORGANIZER") {
            return res.status(403).json({
                success: false,
                error: "Forbidden",
            });
        }
        const result = await (0, organizers_service_1.deleteOrganizerMessage)(id, messageId);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                error: "Organizer not found",
            });
        }
        return res.json({
            success: true,
            data: {
                deleted: true,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error deleting organizer message (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to delete message",
            details: error.message,
        });
    }
}
// ---------- Organizer connections ----------
async function getOrganizerConnectionsHandler(req, res) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        if (!id || id === "undefined") {
            return res.status(400).json({
                success: false,
                error: "Invalid organizer ID",
            });
        }
        if (!auth || (auth.sub !== id && auth.role !== "ORGANIZER")) {
            return res.status(403).json({
                success: false,
                error: "Forbidden",
            });
        }
        const connections = await (0, organizers_service_1.listOrganizerConnections)(id);
        return res.json({
            success: true,
            connections,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer connections (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch connections",
            details: error.message,
        });
    }
}
// ---------- Organizer leads ----------
async function getOrganizerLeadsHandler(req, res) {
    try {
        const { id } = req.params;
        const result = await (0, organizers_service_1.listOrganizerLeads)(id);
        return res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer leads (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch organizer leads",
            details: error.message,
        });
    }
}
async function getOrganizerExhibitorLeadsHandler(req, res) {
    try {
        const { id } = req.params;
        const result = await (0, organizers_service_1.listOrganizerLeadsByType)(id, "EXHIBITOR");
        return res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer exhibitor leads (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch exhibitor leads",
            details: error.message,
        });
    }
}
async function getOrganizerAttendeeLeadsHandler(req, res) {
    try {
        const { id } = req.params;
        const result = await (0, organizers_service_1.listOrganizerLeadsByType)(id, "ATTENDEE");
        return res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer attendee leads (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch attendee leads",
            details: error.message,
        });
    }
}
// ---------- Organizer promotions ----------
async function getOrganizerPromotionsHandler(req, res) {
    try {
        const { id } = req.params;
        const promotions = await (0, organizers_service_1.listOrganizerPromotions)(id);
        return res.json({
            success: true,
            data: {
                promotions,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer promotions (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch promotions",
            details: error.message,
        });
    }
}
async function createOrganizerPromotionHandler(req, res) {
    try {
        const auth = req.auth;
        const { id } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({
                success: false,
                error: "Invalid organizer ID",
            });
        }
        if (auth.sub !== id && auth.role !== "ORGANIZER") {
            return res.status(403).json({
                success: false,
                error: "Forbidden",
            });
        }
        const body = req.body;
        const result = await (0, organizers_service_1.createOrganizerPromotion)(id, body);
        if ("error" in result) {
            if (result.error === "EVENT_REQUIRED") {
                return res.status(400).json({
                    success: false,
                    error: "eventId is required",
                });
            }
            if (result.error === "NOT_FOUND") {
                return res.status(404).json({
                    success: false,
                    error: "Event not found or access denied",
                });
            }
        }
        return res.status(201).json({
            success: true,
            data: result.promotion,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating organizer promotion (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to create promotion",
            details: error.message,
        });
    }
}
// ---------- Organizer subscription ----------
async function getOrganizerSubscriptionHandler(req, res) {
    try {
        const { id } = req.params;
        const summary = await (0, organizers_service_1.getOrganizerSubscriptionSummary)(id);
        if (!summary) {
            return res.status(404).json({
                success: false,
                error: "Organizer not found",
            });
        }
        return res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer subscription (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch subscription",
            details: error.message,
        });
    }
}
async function updateOrganizerSubscriptionHandler(req, res) {
    try {
        const auth = req.auth;
        const { id } = req.params;
        if (!id || id === "undefined") {
            return res.status(400).json({
                success: false,
                error: "Invalid organizer ID",
            });
        }
        if (auth.sub !== id && auth.role !== "ORGANIZER") {
            return res.status(403).json({
                success: false,
                error: "Forbidden",
            });
        }
        const body = req.body;
        const updated = await (0, organizers_service_1.updateOrganizerSubscriptionSummary)(id, body);
        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Organizer not found",
            });
        }
        return res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error updating organizer subscription (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to update subscription",
            details: error.message,
        });
    }
}
// ---------- Organizer reviews ----------
async function getOrganizerReviewsHandler(req, res) {
    try {
        const { id } = req.params;
        const organizerProfile = await (0, organizers_service_1.getOrganizerById)(id, undefined);
        if (!organizerProfile) {
            return res.status(404).json({ success: false, error: "Organizer not found" });
        }
        const includeReplies = req.query.includeReplies === "true";
        const reviews = await (0, organizers_service_1.listOrganizerReviews)(id, { includeReplies });
        const organizer = await prisma_1.default.user.findFirst({
            where: { id: organizerProfile.id, role: "ORGANIZER" },
            select: {
                id: true,
                averageRating: true,
                totalReviews: true,
                organizationName: true,
                firstName: true,
                lastName: true,
            },
        });
        const payload = {
            success: true,
            reviews,
        };
        payload.data = { reviews };
        if (organizer) {
            payload.organizer = {
                id: organizer.id,
                name: organizer.organizationName || `${organizer.firstName ?? ""} ${organizer.lastName ?? ""}`.trim(),
                averageRating: organizer.averageRating ?? 0,
                totalReviews: organizer.totalReviews ?? 0,
            };
        }
        return res.json(payload);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching organizer reviews (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch reviews",
            details: error.message,
        });
    }
}
async function createOrganizerReviewHandler(req, res) {
    try {
        const { id: organizerIdentifier } = req.params;
        const userId = req.auth?.sub;
        const { rating, comment, title } = req.body ?? {};
        if (!organizerIdentifier) {
            return res.status(400).json({ success: false, error: "Invalid organizer ID" });
        }
        if (!userId) {
            return res.status(401).json({ success: false, error: "Authentication required to submit a review" });
        }
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, error: "Rating must be between 1 and 5" });
        }
        if (!comment || !String(comment).trim()) {
            return res.status(400).json({ success: false, error: "Comment is required" });
        }
        const organizerProfile = await (0, organizers_service_1.getOrganizerById)(organizerIdentifier, undefined);
        if (!organizerProfile) {
            return res.status(404).json({ success: false, error: "Organizer not found" });
        }
        const review = await (0, organizers_service_1.createOrganizerReview)({
            organizerId: organizerProfile.id,
            userId,
            rating: Number(rating),
            comment: String(comment).trim(),
            title: title ?? undefined,
        });
        return res.status(201).json(review);
    }
    catch (error) {
        if (error?.message?.includes("already reviewed")) {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error?.message?.includes("not found")) {
            return res.status(404).json({ success: false, error: error.message });
        }
        // eslint-disable-next-line no-console
        console.error("Error creating organizer review (backend):", error);
        return res.status(500).json({ success: false, error: "Failed to create review" });
    }
}
