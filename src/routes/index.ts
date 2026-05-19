import { Router } from "express";
import authRouter from "./auth";
import adminRouter from "./admin";
import uploadRouter from "./upload";
import venueManagerRouter from "./venue-manager";
import userByIdRouter from "./user-by-id";
import eventsRouter from "../modules/events/events.routes";
import organizersRouter from "../modules/organizers/organizers.routes";
import exhibitorsRouter from "../modules/exhibitors/exhibitors.routes";
import venuesRouter from "../modules/venues/venues.routes";
import speakersRouter from "../modules/speakers/speakers.routes";
import appointmentsRouter from "../modules/appointments/appointments.routes";
import conferencesRouter from "../modules/conferences/conferences.routes";
import exhibitorManualsRouter from "../modules/exhibitor-manuals/exhibitor-manuals.routes";
import materialsRouter from "../modules/materials/materials.routes";
import sessionsRouter from "./sessions";
import contentRouter from "./content";
import reviewsRouter from "./reviews";
import connectionsRouter from "../modules/network/connections.routes";
import followRouter from "../modules/follow/follow.routes";
import networkRouter from "../modules/network/network.routes";
import conversationsRouter from "../modules/messages/conversations.routes";
import messagesRouter from "../modules/messages/messages.routes";
import locationRouter from "../modules/location/location.routes";
import geoRouter from "../modules/geo/geo.routes";
import marketingPublicRouter from "../modules/admin/marketing/marketing-public.routes";
import promotionPackagesRouter from "../modules/promotion-packages/promotion-packages.routes";
import settingsRouter from "../modules/settings/settings.routes";
import supportUserRouter from "./support-user";

const router = Router();

// Placeholder root route for the backend API
router.get("/", (_req, res) => {
  res.json({ message: "Biz backend API root" });
});

// Example API health endpoint
router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth-related routes (OTP, login, refresh)
router.use("/auth", authRouter);

// User dashboard settings (privacy, notifications, email verify, deactivate)
router.use("/settings", settingsRouter);

// Logged-in user: raise & view support tickets (Express API only — not Next.js)
router.use("/support", supportUserRouter);

// User by id (for Next.js server: visitor dashboard etc.) — secured by INTERNAL_API_SECRET
router.use("/", userByIdRouter);

// Admin routes (event create, etc.)
router.use("/admin", adminRouter);

// Upload routes
router.use("/", uploadRouter);

// Venue manager routes
router.use("/", venueManagerRouter);

// Event networking discovery (must be before events router so /events/:eventId/network matches)
router.use("/events", networkRouter);

// Public location data (countries / cities for browse + venue forms)
router.use("/location", locationRouter);

// Visitor IP → geo (country/city) for localized home content
router.use("/geo", geoRouter);

// Cross-dashboard marketing feed (requires logged-in user token)
router.use("/marketing", marketingPublicRouter);

// Promotion packages feed for organizer/exhibitor dashboards
router.use("/", promotionPackagesRouter);

// Events & search routes
router.use("/", eventsRouter);

// Organizers routes
router.use("/", organizersRouter);

// Exhibitors routes
router.use("/", exhibitorsRouter);

// Venues routes
router.use("/", venuesRouter);

// Speakers routes
router.use("/", speakersRouter);

// Appointments routes (venue appointments, etc.)
router.use("/", appointmentsRouter);

// Conferences (event agenda / conference agenda)
router.use("/", conferencesRouter);

// Exhibitor manuals (PDFs per event)
router.use("/", exhibitorManualsRouter);

// Speaker session materials & session update
router.use("/", materialsRouter);
router.use("/", sessionsRouter);

// Content (banners — returns [] from backend; no Banner table)
router.use("/", contentRouter);

// Review replies (organizer replies to event feedback)
router.use("/", reviewsRouter);

// Network: connections (LinkedIn-style)
router.use("/connections", connectionsRouter);

// Follow: follow/unfollow user (e.g. follow exhibitor)
router.use("/follow", followRouter);

// Messaging: conversations and messages
router.use("/conversations", conversationsRouter);
router.use("/messages", messagesRouter);

export default router;

