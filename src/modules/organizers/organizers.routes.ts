import { Router } from "express";
import {
  getOrganizersHandler,
  getOrganizerFacetsHandler,
  getOrganizerHandler,
  getOrganizerAnalyticsHandler,
  getOrganizerTotalAttendeesHandler,
  getOrganizerEventsHandler,
  updateOrganizerEventHandler,
  deleteOrganizerEventHandler,
  createOrganizerEventHandler,
  getOrganizerMessagesHandler,
  createOrganizerMessageHandler,
  deleteOrganizerMessageHandler,
  getOrganizerLeadsHandler,
  getOrganizerExhibitorLeadsHandler,
  getOrganizerAttendeeLeadsHandler,
  getOrganizerPromotionsHandler,
  createOrganizerPromotionHandler,
  getOrganizerSubscriptionHandler,
  updateOrganizerSubscriptionHandler,
  getOrganizerReviewsHandler,
  createOrganizerReviewHandler,
  updateOrganizerProfileHandler,
  getOrganizerConnectionsHandler,
} from "./organizers.controller";
import { requireUser, optionalUser } from "../../middleware/auth.middleware";
import {
  publicOrganizersFacetsLimiter,
  publicOrganizersListLimiter,
} from "../../middleware/public-directory-rate-limit";

const router = Router();

// List organizers
router.get("/organizers/facets", publicOrganizersFacetsLimiter, getOrganizerFacetsHandler);
router.get("/organizers", publicOrganizersListLimiter, getOrganizersHandler);

// Single organizer details (optional JWT so the organizer can view their own private profile)
router.get("/organizers/:id", optionalUser, getOrganizerHandler);

// Organizer updates their own profile
router.patch("/organizers/:id", requireUser, updateOrganizerProfileHandler);

// Organizer analytics
router.get("/organizers/:id/analytics", getOrganizerAnalyticsHandler);

// Organizer total attendees
router.get("/organizers/:id/total-attendees", getOrganizerTotalAttendeesHandler);

// Organizer events (owner sees all; public sees only site-visible events)
router.get("/organizers/:id/events", optionalUser, getOrganizerEventsHandler);

// Organizer event create/update/delete
// NOTE: POST is currently left public so that the Next.js organizer
// dashboard (which uses NextAuth sessions, not backend JWT) can submit
// events for approval without a Bearer token. Admin approval flow and
// status checks still gate what gets published.
router.post("/organizers/:id/events", createOrganizerEventHandler);
router.put("/organizers/:id/events/:eventId", requireUser, updateOrganizerEventHandler);
router.delete("/organizers/:id/events/:eventId", requireUser, deleteOrganizerEventHandler);

// Organizer messages (dashboard, authenticated)
router.get("/organizers/:id/messages", requireUser, getOrganizerMessagesHandler);
router.post("/organizers/:id/messages", requireUser, createOrganizerMessageHandler);
router.delete(
  "/organizers/:id/messages/:messageId",
  requireUser,
  deleteOrganizerMessageHandler
);

// Organizer leads (dashboard, authenticated)
router.get("/organizers/:id/leads", requireUser, getOrganizerLeadsHandler);
router.get(
  "/organizers/:id/leads/exhibitor",
  requireUser,
  getOrganizerExhibitorLeadsHandler
);
router.get(
  "/organizers/:id/leads/attendees",
  requireUser,
  getOrganizerAttendeeLeadsHandler
);

// Organizer attendees alias (same as leads/attendees for now)
router.get(
  "/organizers/:id/attendees",
  requireUser,
  getOrganizerAttendeeLeadsHandler
);

// Organizer connections (dashboard)
router.get(
  "/organizers/:id/connections",
  requireUser,
  getOrganizerConnectionsHandler
);

// Organizer promotions (dashboard, authenticated)
router.get("/organizers/:id/promotions", requireUser, getOrganizerPromotionsHandler);
router.post("/organizers/:id/promotions", requireUser, createOrganizerPromotionHandler);

// Organizer subscription (dashboard, authenticated)
router.get("/organizers/:id/subscription", requireUser, getOrganizerSubscriptionHandler);
router.put(
  "/organizers/:id/subscription",
  requireUser,
  updateOrganizerSubscriptionHandler
);

// Organizer reviews (public GET for profile + dashboard; POST requires auth)
router.get("/organizers/:id/reviews", getOrganizerReviewsHandler);
router.post("/organizers/:id/reviews", requireUser, createOrganizerReviewHandler);

export default router;

