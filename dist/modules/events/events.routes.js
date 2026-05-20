"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const events_controller_1 = require("./events.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Active taxonomy for organizers & public (before /events/:id)
router.get("/event-categories", events_controller_1.getPublicEventCategoriesHandler);
// DB-backed categories + event counts (homepage sidebars, no auth)
router.get("/events/categories/browse", events_controller_1.getEventCategoriesBrowseHandler);
// List events, with filters & pagination
router.get("/events", events_controller_1.getEventsHandler);
// Recent events
router.get("/events/recent", events_controller_1.getRecentEventsHandler);
// VIP events
router.get("/events/vip", events_controller_1.getVipEventsHandler);
// Featured events (before :id)
router.get("/events/featured", events_controller_1.getFeaturedEventsHandler);
// Events stats (categories, cities, countries)
router.get("/events/stats", events_controller_1.getEventsStatsHandler);
// Global speaker sessions (must be before /events/:id so "speakers" is not matched as :id)
router.get("/events/speakers", events_controller_1.listSpeakerSessionsHandler);
router.post("/events/speakers", auth_middleware_1.requireUser, events_controller_1.createSpeakerSessionHandler);
// Event followers (saved event users) and reviews (before :id)
router.get("/events/:id/followers", events_controller_1.getEventFollowersHandler);
router.get("/events/:id/reviews", events_controller_1.getEventReviewsHandler);
router.post("/events/:id/reviews", auth_middleware_1.requireUser, events_controller_1.createEventReviewHandler);
// Single event by id / slug / title (optional JWT: organizer/venue host can view non-public listings)
router.get("/events/:id", auth_middleware_1.optionalUser, events_controller_1.getEventByIdHandler);
// Partial update (description, tags, images, brochure, layoutPlan)
// NOTE: Left unauthenticated so organizer dashboard via Next.js can patch without backend JWT.
router.patch("/events/:id", events_controller_1.patchEventByIdHandler);
// Event sub-resources (leads, attendees, exhibitors, speakers, brochure, layout, space-costs)
router.get("/events/:id/leads", events_controller_1.getEventLeadsHandler);
router.get("/events/:id/attendees", events_controller_1.getEventAttendeesHandler);
router.post("/events/:id/leads", auth_middleware_1.requireUser, events_controller_1.createEventLeadHandler);
router.get("/events/:id/exhibitors", events_controller_1.getEventExhibitorsHandler);
router.get("/events/:id/speakers", events_controller_1.getEventSpeakersHandler);
router.get("/events/:id/brochure", events_controller_1.getEventBrochureHandler);
router.put("/events/:id/layout", auth_middleware_1.requireUser, events_controller_1.updateEventLayoutHandler);
router.delete("/events/:id/layout", auth_middleware_1.requireUser, events_controller_1.deleteEventLayoutHandler);
router.get("/events/:id/space-costs", events_controller_1.getEventSpaceCostsHandler);
// Exhibition spaces (list, create, update) — for Event Info Space Cost tab & Add Exhibitor
router.get("/events/:id/exhibition-spaces", events_controller_1.getExhibitionSpacesHandler);
router.post("/events/:id/exhibition-spaces", events_controller_1.createExhibitionSpaceHandler);
router.put("/events/:id/exhibition-spaces/:spaceId", events_controller_1.updateExhibitionSpaceHandler);
// Add exhibitor to event (create booth); remove exhibitor from event
router.post("/events/:id/exhibitors", events_controller_1.addExhibitorToEventHandler);
router.delete("/events/:id/exhibitors/:exhibitorId", events_controller_1.removeExhibitorFromEventHandler);
// Save / unsave event (user only)
router.post("/events/:id/save", auth_middleware_1.requireUser, events_controller_1.saveEventHandler);
router.delete("/events/:id/save", auth_middleware_1.requireUser, events_controller_1.unsaveEventHandler);
router.get("/events/:id/save", auth_middleware_1.requireUser, events_controller_1.isEventSavedHandler);
// Event promotions (GET public, POST authenticated)
router.get("/events/:id/promotions", events_controller_1.getEventPromotionsHandler);
router.post("/events/:id/promotions", auth_middleware_1.requireUser, events_controller_1.createPromotionHandler);
// Global search (events, venues, speakers)
router.get("/search", events_controller_1.searchHandler);
exports.default = router;
