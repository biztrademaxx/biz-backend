import { Router } from "express";
import {
  getEventsHandler,
  getEventByIdHandler,
  patchEventByIdHandler,
  getFeaturedEventsHandler,
  getEventsStatsHandler,
  searchHandler,
  saveEventHandler,
  unsaveEventHandler,
  isEventSavedHandler,
  getEventPromotionsHandler,
  createPromotionHandler,
  getRecentEventsHandler,
  getVipEventsHandler,
  getEventLeadsHandler,
  getEventAttendeesHandler,
  createEventLeadHandler,
  getEventExhibitorsHandler,
  getEventSpeakersHandler,
  getEventBrochureHandler,
  updateEventLayoutHandler,
  deleteEventLayoutHandler,
  getEventSpaceCostsHandler,
  listSpeakerSessionsHandler,
  createSpeakerSessionHandler,
  getExhibitionSpacesHandler,
  createExhibitionSpaceHandler,
  updateExhibitionSpaceHandler,
  addExhibitorToEventHandler,
  removeExhibitorFromEventHandler,
  getEventFollowersHandler,
  getEventReviewsHandler,
  createEventReviewHandler,
  getPublicEventCategoriesHandler,
  getEventCategoriesBrowseHandler,
} from "./events.controller";
import { requireUser, optionalUser } from "../../middleware/auth.middleware";

const router = Router();

// Active taxonomy for organizers & public (before /events/:id)
router.get("/event-categories", getPublicEventCategoriesHandler);

// DB-backed categories + event counts (homepage sidebars, no auth)
router.get("/events/categories/browse", getEventCategoriesBrowseHandler);

// List events, with filters & pagination
router.get("/events", getEventsHandler);

// Recent events
router.get("/events/recent", getRecentEventsHandler);

// VIP events
router.get("/events/vip", getVipEventsHandler);

// Featured events (before :id)
router.get("/events/featured", getFeaturedEventsHandler);

// Events stats (categories, cities, countries)
router.get("/events/stats", getEventsStatsHandler);

// Global speaker sessions (must be before /events/:id so "speakers" is not matched as :id)
router.get("/events/speakers", listSpeakerSessionsHandler);
router.post("/events/speakers", requireUser, createSpeakerSessionHandler);

// Event followers (saved event users) and reviews (before :id)
router.get("/events/:id/followers", getEventFollowersHandler);
router.get("/events/:id/reviews", getEventReviewsHandler);
router.post("/events/:id/reviews", requireUser, createEventReviewHandler);

// Single event by id / slug / title (optional JWT: organizer/venue host can view non-public listings)
router.get("/events/:id", optionalUser, getEventByIdHandler);
// Partial update (description, tags, images, brochure, layoutPlan; schedule requires auth)
router.patch("/events/:id", optionalUser, patchEventByIdHandler);

// Event sub-resources (leads, attendees, exhibitors, speakers, brochure, layout, space-costs)
router.get("/events/:id/leads", getEventLeadsHandler);
router.get("/events/:id/attendees", getEventAttendeesHandler);
router.post("/events/:id/leads", requireUser, createEventLeadHandler);
router.get("/events/:id/exhibitors", getEventExhibitorsHandler);
router.get("/events/:id/speakers", getEventSpeakersHandler);
router.get("/events/:id/brochure", getEventBrochureHandler);
router.put("/events/:id/layout", requireUser, updateEventLayoutHandler);
router.delete("/events/:id/layout", requireUser, deleteEventLayoutHandler);
router.get("/events/:id/space-costs", getEventSpaceCostsHandler);

// Exhibition spaces (list, create, update) — for Event Info Space Cost tab & Add Exhibitor
router.get("/events/:id/exhibition-spaces", getExhibitionSpacesHandler);
router.post("/events/:id/exhibition-spaces", createExhibitionSpaceHandler);
router.put("/events/:id/exhibition-spaces/:spaceId", updateExhibitionSpaceHandler);

// Add exhibitor to event (create booth); remove exhibitor from event
router.post("/events/:id/exhibitors", addExhibitorToEventHandler);
router.delete("/events/:id/exhibitors/:exhibitorId", removeExhibitorFromEventHandler);

// Save / unsave event (user only)
router.post("/events/:id/save", requireUser, saveEventHandler);
router.delete("/events/:id/save", requireUser, unsaveEventHandler);
router.get("/events/:id/save", requireUser, isEventSavedHandler);

// Event promotions (GET public, POST authenticated)
router.get("/events/:id/promotions", getEventPromotionsHandler);
router.post("/events/:id/promotions", requireUser, createPromotionHandler);

// Global search (events, venues, speakers)
router.get("/search", searchHandler);

export default router;

