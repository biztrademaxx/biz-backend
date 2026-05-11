"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const organizers_controller_1 = require("./organizers.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// List organizers
router.get("/organizers", organizers_controller_1.getOrganizersHandler);
// Single organizer details (optional JWT so the organizer can view their own private profile)
router.get("/organizers/:id", auth_middleware_1.optionalUser, organizers_controller_1.getOrganizerHandler);
// Organizer updates their own profile
router.patch("/organizers/:id", auth_middleware_1.requireUser, organizers_controller_1.updateOrganizerProfileHandler);
// Organizer analytics
router.get("/organizers/:id/analytics", organizers_controller_1.getOrganizerAnalyticsHandler);
// Organizer total attendees
router.get("/organizers/:id/total-attendees", organizers_controller_1.getOrganizerTotalAttendeesHandler);
// Organizer events (owner sees all; public sees only site-visible events)
router.get("/organizers/:id/events", auth_middleware_1.optionalUser, organizers_controller_1.getOrganizerEventsHandler);
// Organizer event create/update/delete
// NOTE: POST is currently left public so that the Next.js organizer
// dashboard (which uses NextAuth sessions, not backend JWT) can submit
// events for approval without a Bearer token. Admin approval flow and
// status checks still gate what gets published.
router.post("/organizers/:id/events", organizers_controller_1.createOrganizerEventHandler);
router.put("/organizers/:id/events/:eventId", auth_middleware_1.requireUser, organizers_controller_1.updateOrganizerEventHandler);
router.delete("/organizers/:id/events/:eventId", auth_middleware_1.requireUser, organizers_controller_1.deleteOrganizerEventHandler);
// Organizer messages (dashboard, authenticated)
router.get("/organizers/:id/messages", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerMessagesHandler);
router.post("/organizers/:id/messages", auth_middleware_1.requireUser, organizers_controller_1.createOrganizerMessageHandler);
router.delete("/organizers/:id/messages/:messageId", auth_middleware_1.requireUser, organizers_controller_1.deleteOrganizerMessageHandler);
// Organizer leads (dashboard, authenticated)
router.get("/organizers/:id/leads", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerLeadsHandler);
router.get("/organizers/:id/leads/exhibitor", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerExhibitorLeadsHandler);
router.get("/organizers/:id/leads/attendees", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerAttendeeLeadsHandler);
// Organizer attendees alias (same as leads/attendees for now)
router.get("/organizers/:id/attendees", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerAttendeeLeadsHandler);
// Organizer connections (dashboard)
router.get("/organizers/:id/connections", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerConnectionsHandler);
// Organizer promotions (dashboard, authenticated)
router.get("/organizers/:id/promotions", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerPromotionsHandler);
router.post("/organizers/:id/promotions", auth_middleware_1.requireUser, organizers_controller_1.createOrganizerPromotionHandler);
// Organizer subscription (dashboard, authenticated)
router.get("/organizers/:id/subscription", auth_middleware_1.requireUser, organizers_controller_1.getOrganizerSubscriptionHandler);
router.put("/organizers/:id/subscription", auth_middleware_1.requireUser, organizers_controller_1.updateOrganizerSubscriptionHandler);
// Organizer reviews (public GET for profile + dashboard; POST requires auth)
router.get("/organizers/:id/reviews", organizers_controller_1.getOrganizerReviewsHandler);
router.post("/organizers/:id/reviews", auth_middleware_1.requireUser, organizers_controller_1.createOrganizerReviewHandler);
exports.default = router;
