"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicEventCategoriesHandler = getPublicEventCategoriesHandler;
exports.getEventCategoriesBrowseHandler = getEventCategoriesBrowseHandler;
exports.getEventsHandler = getEventsHandler;
exports.getEventByIdHandler = getEventByIdHandler;
exports.patchEventByIdHandler = patchEventByIdHandler;
exports.getFeaturedEventsHandler = getFeaturedEventsHandler;
exports.getRecentEventsHandler = getRecentEventsHandler;
exports.getVipEventsHandler = getVipEventsHandler;
exports.getEventAttendeesHandler = getEventAttendeesHandler;
exports.getEventLeadsHandler = getEventLeadsHandler;
exports.createEventLeadHandler = createEventLeadHandler;
exports.getEventExhibitorsHandler = getEventExhibitorsHandler;
exports.getEventSpeakersHandler = getEventSpeakersHandler;
exports.listSpeakerSessionsHandler = listSpeakerSessionsHandler;
exports.getEventBrochureHandler = getEventBrochureHandler;
exports.updateEventLayoutHandler = updateEventLayoutHandler;
exports.deleteEventLayoutHandler = deleteEventLayoutHandler;
exports.getEventSpaceCostsHandler = getEventSpaceCostsHandler;
exports.getExhibitionSpacesHandler = getExhibitionSpacesHandler;
exports.createExhibitionSpaceHandler = createExhibitionSpaceHandler;
exports.updateExhibitionSpaceHandler = updateExhibitionSpaceHandler;
exports.addExhibitorToEventHandler = addExhibitorToEventHandler;
exports.removeExhibitorFromEventHandler = removeExhibitorFromEventHandler;
exports.getEventsStatsHandler = getEventsStatsHandler;
exports.searchHandler = searchHandler;
exports.saveEventHandler = saveEventHandler;
exports.unsaveEventHandler = unsaveEventHandler;
exports.isEventSavedHandler = isEventSavedHandler;
exports.getEventPromotionsHandler = getEventPromotionsHandler;
exports.createPromotionHandler = createPromotionHandler;
exports.createEventAdminHandler = createEventAdminHandler;
exports.createSpeakerSessionHandler = createSpeakerSessionHandler;
exports.getEventFollowersHandler = getEventFollowersHandler;
exports.getEventReviewsHandler = getEventReviewsHandler;
exports.createEventReviewHandler = createEventReviewHandler;
const events_service_1 = require("./events.service");
const events_writes_service_1 = require("./events-writes.service");
const prisma_1 = __importDefault(require("../../config/prisma"));
const event_categories_service_1 = require("../admin/event-categories/event-categories.service");
/** Public list of active event categories (organizer create-event, filters). */
async function getPublicEventCategoriesHandler(_req, res) {
    try {
        const categories = await (0, event_categories_service_1.listActiveEventCategoriesPublic)();
        return res.json({ success: true, data: categories });
    }
    catch (e) {
        return res.status(500).json({
            success: false,
            error: e?.message || "Failed to load event categories",
        });
    }
}
/** Homepage / browse: active categories from DB + published public event counts. */
async function getEventCategoriesBrowseHandler(_req, res) {
    try {
        const categories = await (0, event_categories_service_1.listActiveEventCategoriesWithEventCounts)();
        return res.json({ success: true, categories });
    }
    catch (e) {
        return res.status(500).json({
            success: false,
            error: e?.message || "Failed to load event categories",
        });
    }
}
async function getEventsHandler(req, res) {
    try {
        const { page, limit, category, search, location, startDate, endDate, featured, sort, verified, vip, stats, } = req.query;
        // If stats=true, return category stats (backward-compatible behavior)
        if (stats === "true") {
            const data = await (0, events_service_1.getCategoryStats)();
            return res.json({
                success: true,
                ...data,
            });
        }
        const pageNum = page ? parseInt(page, 10) : undefined;
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        const result = await (0, events_service_1.listEvents)({
            page: pageNum,
            limit: limitNum,
            category: category ?? null,
            search: search ?? "",
            location: location ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            featured: featured === "true",
            sort: sort ?? "newest",
            verified: verified === "true",
            vip: vip === "true",
        });
        return res.json({
            success: true,
            events: result.events,
            pagination: result.pagination,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching events (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch events",
            details: error.message,
        });
    }
}
async function getEventByIdHandler(req, res) {
    try {
        const { id } = req.params;
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const event = await (0, events_service_1.getEventByIdentifier)(id, viewerId);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        // Note: we don't set cache headers here; that can be done at gateway/proxy level
        return res.json(event);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching event (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function patchEventByIdHandler(req, res) {
    try {
        const { id } = req.params;
        const body = (req.body ?? {});
        const updated = await (0, events_service_1.updateEventFields)(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, error: "Event not found" });
        }
        return res.json(updated);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error patching event (backend):", error);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
}
async function getFeaturedEventsHandler(_req, res) {
    try {
        const events = await (0, events_service_1.getFeaturedEvents)();
        return res.json(events);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch featured events (backend):", error);
        return res.status(500).json({ error: "Failed to fetch featured events" });
    }
}
async function getRecentEventsHandler(_req, res) {
    try {
        const events = await (0, events_service_1.listRecentEvents)(10);
        return res.json(events);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch recent events (backend):", error);
        return res.status(500).json({ error: "Failed to fetch recent events" });
    }
}
async function getVipEventsHandler(_req, res) {
    try {
        const events = await (0, events_service_1.listVipEvents)(12);
        // Array kept for older clients; object shape for structured consumers.
        return res.json({ success: true, events });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch VIP events (backend):", error);
        return res.status(500).json({ error: "Failed to fetch VIP events" });
    }
}
// ----- Event sub-resources -----
async function getEventAttendeesHandler(req, res) {
    try {
        const { id } = req.params;
        const attendeeLeads = await (0, events_service_1.listEventAttendees)(id);
        return res.json({
            success: true,
            attendeeLeads,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching event attendees (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event attendees",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function getEventLeadsHandler(req, res) {
    try {
        const { id } = req.params;
        const leads = await (0, events_service_1.listEventLeads)(id);
        return res.json({
            success: true,
            data: {
                leads,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching event leads (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event leads",
            details: error.message,
        });
    }
}
async function createEventLeadHandler(req, res) {
    try {
        const { id: eventId } = req.params;
        const { type } = req.body;
        const userId = req.auth?.sub;
        if (!eventId) {
            return res.status(400).json({ error: "Event ID is required" });
        }
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!type) {
            return res.status(400).json({ error: "type is required" });
        }
        const result = await (0, events_service_1.createEventLead)({ eventId, userId, type });
        if ("error" in result) {
            if (result.error === "EVENT_NOT_FOUND") {
                return res.status(404).json({ error: "Event not found" });
            }
            if (result.error === "USER_NOT_FOUND") {
                return res.status(404).json({ error: "User not found" });
            }
            return res.status(400).json({ error: "Bad request" });
        }
        if (result.alreadyExists) {
            return res.status(200).json({
                success: true,
                message: result.message,
                lead: result.lead,
            });
        }
        return res.status(201).json({
            success: true,
            message: result.message,
            lead: result.lead,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating event lead (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getEventExhibitorsHandler(req, res) {
    try {
        const { id } = req.params;
        const exhibitors = await (0, events_service_1.listEventExhibitors)(id);
        return res.json({
            success: true,
            data: {
                exhibitors,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching event exhibitors (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event exhibitors",
            details: error.message,
        });
    }
}
async function getEventSpeakersHandler(req, res) {
    try {
        const { id } = req.params;
        const speakers = await (0, events_service_1.listEventSpeakers)(id);
        return res.json({
            success: true,
            data: {
                speakers,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching event speakers (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event speakers",
            details: error.message,
        });
    }
}
// Global speakers/session listing for /api/events/speakers
async function listSpeakerSessionsHandler(req, res) {
    try {
        const { eventId, speakerId } = req.query;
        if (!eventId && !speakerId) {
            return res.status(400).json({
                success: false,
                error: "eventId or speakerId is required",
            });
        }
        const sessions = await (0, events_service_1.listSpeakerSessions)({
            eventId: eventId ?? null,
            speakerId: speakerId ?? null,
        });
        // Serialize for JSON (e.g. Date -> ISO string)
        const serialized = sessions.map((s) => ({
            ...s,
            startTime: s.startTime instanceof Date ? s.startTime.toISOString() : s.startTime,
            endTime: s.endTime instanceof Date ? s.endTime.toISOString() : s.endTime,
            event: s.event
                ? {
                    ...s.event,
                    startDate: s.event.startDate instanceof Date ? s.event.startDate.toISOString() : s.event.startDate,
                    endDate: s.event.endDate instanceof Date ? s.event.endDate.toISOString() : s.event.endDate,
                }
                : null,
        }));
        return res.json({
            success: true,
            sessions: serialized,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error listing speaker sessions (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to list speaker sessions",
            details: error?.message,
            sessions: [],
        });
    }
}
async function getEventBrochureHandler(req, res) {
    try {
        const { id } = req.params;
        const event = await (0, events_service_1.getEventBrochureAndDocuments)(id);
        if (!event) {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: {
                eventId: event.id,
                brochure: event.brochure,
                documents: event.documents,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching event brochure (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event brochure",
            details: error.message,
        });
    }
}
async function updateEventLayoutHandler(req, res) {
    try {
        const { id } = req.params;
        const { layoutPlan } = req.body;
        if (layoutPlan !== null && typeof layoutPlan !== "string") {
            return res.status(400).json({
                success: false,
                error: "layoutPlan must be a string or null",
            });
        }
        const updated = await (0, events_service_1.updateEventLayoutPlan)(id, layoutPlan ?? null);
        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error updating event layout (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to update event layout",
            details: error.message,
        });
    }
}
async function deleteEventLayoutHandler(req, res) {
    try {
        const { id } = req.params;
        const updated = await (0, events_service_1.updateEventLayoutPlan)(id, null);
        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Event not found",
            });
        }
        return res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error deleting event layout (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to delete event layout",
            details: error.message,
        });
    }
}
async function getEventSpaceCostsHandler(req, res) {
    try {
        const { id } = req.params;
        const spaces = await (0, events_service_1.listEventSpaceCosts)(id);
        return res.json({
            success: true,
            data: {
                spaces,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching event space costs (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch event space costs",
            details: error.message,
        });
    }
}
async function getExhibitionSpacesHandler(req, res) {
    try {
        const { id: eventId } = req.params;
        const exhibitionSpaces = await (0, events_service_1.listExhibitionSpaces)(eventId);
        return res.json({ exhibitionSpaces });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibition spaces (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch exhibition spaces",
            details: error.message,
        });
    }
}
async function createExhibitionSpaceHandler(req, res) {
    try {
        const { id: eventId } = req.params;
        const result = await (0, events_service_1.createExhibitionSpace)(eventId, req.body ?? {});
        if ("error" in result) {
            if (result.error === "NOT_FOUND") {
                return res.status(404).json({ error: "Event not found" });
            }
            if (result.error === "NAME_REQUIRED") {
                return res.status(400).json({ error: "name is required" });
            }
            return res.status(400).json({ error: "Bad request" });
        }
        return res.status(201).json(result);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating exhibition space (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to create exhibition space",
            details: error.message,
        });
    }
}
async function updateExhibitionSpaceHandler(req, res) {
    try {
        const { id: eventId, spaceId } = req.params;
        const updated = await (0, events_service_1.updateExhibitionSpace)(eventId, spaceId, req.body ?? {});
        if (!updated) {
            return res.status(404).json({ error: "Exhibition space not found" });
        }
        return res.json(updated);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error updating exhibition space (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to update exhibition space",
            details: error.message,
        });
    }
}
async function addExhibitorToEventHandler(req, res) {
    try {
        const { id: eventId } = req.params;
        const result = await (0, events_service_1.addExhibitorToEvent)(eventId, req.body ?? {});
        if ("error" in result) {
            if (result.error === "EVENT_NOT_FOUND") {
                return res.status(404).json({ error: "Event not found" });
            }
            if (result.error === "EXHIBITOR_NOT_FOUND") {
                return res.status(404).json({ error: "Exhibitor not found" });
            }
            if (result.error === "SPACE_NOT_FOUND") {
                return res.status(404).json({ error: "Exhibition space not found" });
            }
            if (result.error === "ALREADY_REGISTERED") {
                return res.status(409).json({ error: "Exhibitor is already registered for this event" });
            }
            return res.status(400).json({ error: "Bad request" });
        }
        return res.status(201).json(result.booth);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error adding exhibitor to event (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to add exhibitor to event",
            details: error.message,
        });
    }
}
async function removeExhibitorFromEventHandler(req, res) {
    try {
        const { id: eventId, exhibitorId } = req.params;
        if (!exhibitorId) {
            return res.status(400).json({ error: "Exhibitor ID required" });
        }
        const removed = await (0, events_service_1.removeExhibitorFromEvent)(eventId, exhibitorId);
        if (!removed) {
            return res.status(404).json({ error: "Exhibitor not found for this event" });
        }
        return res.status(200).json({ success: true });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error removing exhibitor from event (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to remove exhibitor from event",
            details: error.message,
        });
    }
}
async function getEventsStatsHandler(req, res) {
    try {
        const include = req.query.include ?? "";
        const includes = include ? include.split(",") : [];
        const includeCategories = includes.length === 0 || includes.includes("categories");
        const includeCities = includes.includes("cities");
        const includeCountries = includes.includes("countries");
        const result = await (0, events_service_1.getEventStats)({
            includeCategories,
            includeCities,
            includeCountries,
        });
        return res.json(result);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching stats (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch stats",
            details: error.message,
        });
    }
}
async function searchHandler(req, res) {
    try {
        const q = req.query.q ?? "";
        const limit = req.query.limit ? Number(req.query.limit) : 5;
        const result = await (0, events_service_1.searchEntities)(q, limit);
        return res.json(result);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Search API error (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
// ----- Write handlers (requireUser for save/promotions) -----
async function saveEventHandler(req, res) {
    try {
        const auth = req.auth;
        if (auth.domain !== "USER") {
            return res.status(403).json({ error: "Only user accounts can save events" });
        }
        const userId = auth.sub;
        const eventId = req.params.id;
        const result = await (0, events_service_1.saveEvent)(userId, eventId);
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({ error: "Event not found" });
        }
        if ("alreadySaved" in result && result.alreadySaved) {
            return res.json({ message: "Event already saved", saved: true });
        }
        return res.json({
            message: "Event saved successfully",
            savedEvent: result.savedEvent,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Save event error (backend):", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function unsaveEventHandler(req, res) {
    try {
        const auth = req.auth;
        if (auth.domain !== "USER") {
            return res.status(403).json({ error: "Only user accounts can unsave events" });
        }
        const userId = auth.sub;
        const eventId = req.params.id;
        await (0, events_service_1.unsaveEvent)(userId, eventId);
        return res.json({ message: "Event removed from saved" });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Unsave event error (backend):", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function isEventSavedHandler(req, res) {
    try {
        const auth = req.auth;
        if (auth.domain !== "USER") {
            return res.json({ isSaved: false });
        }
        const userId = auth.sub;
        const eventId = req.params.id;
        const saved = await (0, events_service_1.isEventSaved)(userId, eventId);
        return res.json({ isSaved: saved });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Is event saved error (backend):", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getEventPromotionsHandler(req, res) {
    try {
        const eventId = req.params.id;
        const data = await (0, events_service_1.getEventPromotions)(eventId);
        if (!data) {
            return res.status(404).json({ error: "Event not found" });
        }
        return res.json(data);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Get event promotions error (backend):", err);
        return res.status(500).json({ error: "Failed to fetch promotion data" });
    }
}
async function createPromotionHandler(req, res) {
    try {
        const eventId = req.params.id;
        const body = req.body;
        const packageType = body.packageType ?? "";
        const targetCategories = Array.isArray(body.targetCategories) ? body.targetCategories : [];
        const amount = Number(body.amount) || 0;
        const duration = Number(body.duration) || 0;
        const result = await (0, events_service_1.createPromotion)(eventId, {
            packageType,
            targetCategories,
            amount,
            duration,
        });
        if ("error" in result && result.error === "NOT_FOUND") {
            return res.status(404).json({ error: "Event not found" });
        }
        return res.status(201).json(result.promotion);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Create promotion error (backend):", err);
        return res.status(500).json({ error: "Failed to create promotion" });
    }
}
async function createEventAdminHandler(req, res) {
    try {
        const auth = req.auth;
        if (auth.domain !== "ADMIN" || (auth.role !== "SUPER_ADMIN" && auth.role !== "SUB_ADMIN")) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const result = await (0, events_writes_service_1.createEventAdmin)({
            body: req.body,
            adminId: auth.sub,
            adminType: auth.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "SUB_ADMIN",
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
            if (result.error === "INVALID_YOUTUBE_URL") {
                return res.status(400).json({
                    error: result.message ?? "Invalid YouTube URL",
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
        console.error("Create event (admin) error (backend):", err);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
            details: err?.message,
        });
    }
}
async function createSpeakerSessionHandler(req, res) {
    try {
        const auth = req.auth;
        if (!auth) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const session = await (0, events_writes_service_1.createSpeakerSession)(req.body ?? {});
        return res.status(201).json({
            success: true,
            session,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Create speaker session error (backend):", err);
        return res.status(400).json({
            success: false,
            error: err?.message || "Failed to create speaker session",
        });
    }
}
/** GET /api/events/:id/followers — users who saved this event (event followers). */
async function getEventFollowersHandler(req, res) {
    try {
        const { id: eventId } = req.params;
        if (!eventId) {
            return res.status(400).json({ error: "Event ID required" });
        }
        const saved = await prisma_1.default.savedEvent.findMany({
            where: { eventId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                        role: true,
                        company: true,
                        jobTitle: true,
                    },
                },
            },
            orderBy: { savedAt: "desc" },
        });
        return res.json({
            followers: saved.map((s) => ({
                ...s,
                savedAt: s.savedAt.toISOString(),
            })),
            total: saved.length,
        });
    }
    catch (err) {
        console.error("Error fetching event followers:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
/** GET /api/events/:id/reviews — event reviews with user info. */
async function getEventReviewsHandler(req, res) {
    try {
        const { id: eventId } = req.params;
        const includeReplies = req.query.includeReplies === "true";
        if (!eventId) {
            return res.status(400).json({ error: "Event ID required" });
        }
        const event = await prisma_1.default.event.findUnique({
            where: { id: eventId },
            select: { id: true, title: true, averageRating: true, totalReviews: true },
        });
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        const reviews = await prisma_1.default.review.findMany({
            where: { eventId },
            orderBy: { createdAt: "desc" },
        });
        const reviewsWithUsers = await Promise.all(reviews.map(async (r) => {
            const user = r.userId
                ? await prisma_1.default.user.findUnique({
                    where: { id: r.userId },
                    select: { id: true, firstName: true, lastName: true, avatar: true },
                })
                : null;
            let replies = [];
            if (includeReplies) {
                const replyRows = await prisma_1.default.reviewReply.findMany({
                    where: { reviewId: r.id },
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, avatar: true },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                });
                replies = replyRows.map((rep) => ({
                    id: rep.id,
                    content: rep.content,
                    isOrganizerReply: rep.isOrganizerReply,
                    createdAt: rep.createdAt.toISOString(),
                    user: rep.user || { id: rep.userId, firstName: "Unknown", lastName: "User", avatar: null },
                }));
            }
            return {
                id: r.id,
                rating: r.rating,
                title: r.title ?? "",
                comment: r.comment,
                createdAt: r.createdAt.toISOString(),
                isApproved: true,
                isPublic: true,
                user: user || { id: r.userId, firstName: "Unknown", lastName: "User", avatar: null },
                replies: includeReplies ? replies : undefined,
            };
        }));
        return res.json({
            event: {
                ...event,
                averageRating: event.averageRating ?? 0,
                totalReviews: event.totalReviews ?? 0,
            },
            reviews: reviewsWithUsers,
        });
    }
    catch (err) {
        console.error("Error fetching event reviews:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
/** POST /api/events/:id/reviews — create event review (authenticated). */
async function createEventReviewHandler(req, res) {
    try {
        const { id: eventId } = req.params;
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!eventId) {
            return res.status(400).json({ error: "Event ID required" });
        }
        const { rating, title, comment } = req.body || {};
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" });
        }
        const event = await prisma_1.default.event.findUnique({ where: { id: eventId }, select: { id: true } });
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        const existing = await prisma_1.default.review.findFirst({
            where: { eventId, userId },
        });
        if (existing) {
            return res.status(400).json({ error: "You have already reviewed this event" });
        }
        const review = await prisma_1.default.review.create({
            data: {
                eventId,
                userId,
                rating: Number(rating),
                comment: comment ?? title ?? "",
            },
        });
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true, avatar: true },
        });
        const reviews = await prisma_1.default.review.findMany({
            where: { eventId },
            select: { rating: true },
        });
        const totalRating = reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0);
        const averageRating = reviews.length ? totalRating / reviews.length : 0;
        await prisma_1.default.event.update({
            where: { id: eventId },
            data: { averageRating, totalReviews: reviews.length },
        });
        return res.status(201).json({
            ...review,
            createdAt: review.createdAt.toISOString(),
            user: user || { id: userId, firstName: "Unknown", lastName: "User", avatar: null },
        });
    }
    catch (err) {
        console.error("Error creating event review:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
