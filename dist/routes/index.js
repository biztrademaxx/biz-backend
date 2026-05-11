"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const admin_1 = __importDefault(require("./admin"));
const upload_1 = __importDefault(require("./upload"));
const venue_manager_1 = __importDefault(require("./venue-manager"));
const user_by_id_1 = __importDefault(require("./user-by-id"));
const events_routes_1 = __importDefault(require("../modules/events/events.routes"));
const organizers_routes_1 = __importDefault(require("../modules/organizers/organizers.routes"));
const exhibitors_routes_1 = __importDefault(require("../modules/exhibitors/exhibitors.routes"));
const venues_routes_1 = __importDefault(require("../modules/venues/venues.routes"));
const speakers_routes_1 = __importDefault(require("../modules/speakers/speakers.routes"));
const appointments_routes_1 = __importDefault(require("../modules/appointments/appointments.routes"));
const conferences_routes_1 = __importDefault(require("../modules/conferences/conferences.routes"));
const exhibitor_manuals_routes_1 = __importDefault(require("../modules/exhibitor-manuals/exhibitor-manuals.routes"));
const materials_routes_1 = __importDefault(require("../modules/materials/materials.routes"));
const sessions_1 = __importDefault(require("./sessions"));
const content_1 = __importDefault(require("./content"));
const reviews_1 = __importDefault(require("./reviews"));
const connections_routes_1 = __importDefault(require("../modules/network/connections.routes"));
const follow_routes_1 = __importDefault(require("../modules/follow/follow.routes"));
const network_routes_1 = __importDefault(require("../modules/network/network.routes"));
const conversations_routes_1 = __importDefault(require("../modules/messages/conversations.routes"));
const messages_routes_1 = __importDefault(require("../modules/messages/messages.routes"));
const location_routes_1 = __importDefault(require("../modules/location/location.routes"));
const marketing_public_routes_1 = __importDefault(require("../modules/admin/marketing/marketing-public.routes"));
const promotion_packages_routes_1 = __importDefault(require("../modules/promotion-packages/promotion-packages.routes"));
const settings_routes_1 = __importDefault(require("../modules/settings/settings.routes"));
const support_user_1 = __importDefault(require("./support-user"));
const router = (0, express_1.Router)();
// Placeholder root route for the backend API
router.get("/", (_req, res) => {
    res.json({ message: "Biz backend API root" });
});
// Example API health endpoint
router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
// Auth-related routes (OTP, login, refresh)
router.use("/auth", auth_1.default);
// User dashboard settings (privacy, notifications, email verify, deactivate)
router.use("/settings", settings_routes_1.default);
// Logged-in user: raise & view support tickets (Express API only — not Next.js)
router.use("/support", support_user_1.default);
// User by id (for Next.js server: visitor dashboard etc.) — secured by INTERNAL_API_SECRET
router.use("/", user_by_id_1.default);
// Admin routes (event create, etc.)
router.use("/admin", admin_1.default);
// Upload routes
router.use("/", upload_1.default);
// Venue manager routes
router.use("/", venue_manager_1.default);
// Event networking discovery (must be before events router so /events/:eventId/network matches)
router.use("/events", network_routes_1.default);
// Public location data (countries / cities for browse + venue forms)
router.use("/location", location_routes_1.default);
// Cross-dashboard marketing feed (requires logged-in user token)
router.use("/marketing", marketing_public_routes_1.default);
// Promotion packages feed for organizer/exhibitor dashboards
router.use("/", promotion_packages_routes_1.default);
// Events & search routes
router.use("/", events_routes_1.default);
// Organizers routes
router.use("/", organizers_routes_1.default);
// Exhibitors routes
router.use("/", exhibitors_routes_1.default);
// Venues routes
router.use("/", venues_routes_1.default);
// Speakers routes
router.use("/", speakers_routes_1.default);
// Appointments routes (venue appointments, etc.)
router.use("/", appointments_routes_1.default);
// Conferences (event agenda / conference agenda)
router.use("/", conferences_routes_1.default);
// Exhibitor manuals (PDFs per event)
router.use("/", exhibitor_manuals_routes_1.default);
// Speaker session materials & session update
router.use("/", materials_routes_1.default);
router.use("/", sessions_1.default);
// Content (banners — returns [] from backend; no Banner table)
router.use("/", content_1.default);
// Review replies (organizer replies to event feedback)
router.use("/", reviews_1.default);
// Network: connections (LinkedIn-style)
router.use("/connections", connections_routes_1.default);
// Follow: follow/unfollow user (e.g. follow exhibitor)
router.use("/follow", follow_routes_1.default);
// Messaging: conversations and messages
router.use("/conversations", conversations_routes_1.default);
router.use("/messages", messages_routes_1.default);
exports.default = router;
