import { Router } from "express";
import multer from "multer";
import { requireAdmin, requirePermission } from "../../middleware/auth.middleware";
import {
  adminGetEventsHandler,
  adminGetEventStatsHandler,
  adminGetEventByIdHandler,
  adminUpdateEventHandler,
  adminDeleteEventHandler,
  adminApproveEventHandler,
  adminRejectEventHandler,
  adminGetDashboardHandler,
  adminVerifyEventHandler,
  adminGetEventMailCandidatesHandler,
  adminSendEventListingEmailHandler,
} from "./admin.controller";
import { createEventAdminHandler } from "../events/events.controller";
import { getEventImportJobHandler, postEventImportHandler } from "./event-import/event-import.controller";

import organizersRoutes from "./organizers/organizers.routes";
import exhibitorsRoutes from "./exhibitors/exhibitors.routes";
import speakersRoutes from "./speakers/speakers.routes";
import speakerRoutes from "./speaker/speaker.routes";
import venuesRoutes from "./venues/venues.routes";
import venueRoutes from "./venue/venue.routes";
import visitorsRoutes from "./visitors/visitors.routes";
import usersRoutes from "./users/users.routes";
import subAdminsRoutes from "./sub-admins/sub-admins.routes";
import eventCategoriesRoutes from "./event-categories/event-categories.routes";
import countriesRoutes from "./countries/countries.routes";
import citiesRoutes from "./cities/cities.routes";
import statesRoutes from "./states/states.routes";
import uploadRoutes from "./upload/upload.routes";
import financialRoutes from "./financial/financial.routes";
import reportsRoutes from "./reports/reports.routes";
import notificationsRoutes from "./notifications/notifications.routes";
import settingsRoutes from "./settings/settings.routes";
import supportRoutes from "./support/support.routes";
import integrationsRoutes from "./integrations/integrations.routes";
import analyticsRoutes from "./analytics/analytics.routes";
import marketingRoutes from "./marketing/marketing.routes";
import promotionPackageRoutes from "./promotion-package/promotion-package.routes";
import accountDeactivationRoutes from "./account-deactivation/account-deactivation.routes";
import contentAdminRoutes from "./content/content.routes";
import roleDefinitionsRoutes from "./role-definitions/role-definitions.routes";

const router = Router();

const verifyBadgeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const eventImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Events (existing) ─────────────────────────────────────────────────────
router.get("/events/stats", requireAdmin, adminGetEventStatsHandler);
router.get("/events", requireAdmin, adminGetEventsHandler);
/** Bulk import — must be registered before `/events/:id` so `import` is not captured as :id */
router.post(
  "/events/import",
  requireAdmin,
  eventImportUpload.single("file"),
  postEventImportHandler,
);
router.get("/events/import/:jobId", requireAdmin, getEventImportJobHandler);
router.post(
  "/events/:id/verify",
  requireAdmin,
  verifyBadgeUpload.single("badgeFile"),
  adminVerifyEventHandler
);
router.get("/events/mail-candidates", requireAdmin, adminGetEventMailCandidatesHandler);
router.post("/events/send-listing-email", requireAdmin, adminSendEventListingEmailHandler);
router.get("/events/:id", requireAdmin, adminGetEventByIdHandler);
router.patch("/events/:id", requireAdmin, adminUpdateEventHandler);
router.delete("/events/:id", requireAdmin, adminDeleteEventHandler);
router.post("/events", requireAdmin, createEventAdminHandler);
router.post("/events/approve", requireAdmin, requirePermission("approve_events"), adminApproveEventHandler);
router.post("/events/reject", requireAdmin, requirePermission("approve_events"), adminRejectEventHandler);

// ─── Dashboard ─────────────────────────────────────────────────────────────
router.get("/dashboard", requireAdmin, adminGetDashboardHandler);

// ─── Resource modules ───────────────────────────────────────────────────────
router.use("/organizers", organizersRoutes);
router.use("/exhibitors", exhibitorsRoutes);
router.use("/speakers", speakersRoutes);
router.use("/speaker", speakerRoutes);
router.use("/venues", venuesRoutes);
router.use("/venue", venueRoutes);
router.use("/visitors", visitorsRoutes);
router.use("/users", usersRoutes);
router.use("/sub-admins", subAdminsRoutes);
router.use("/event-categories", eventCategoriesRoutes);
router.use("/countries", countriesRoutes);
router.use("/states", statesRoutes);
router.use("/cities", citiesRoutes);
router.use("/upload", uploadRoutes);
router.use("/financial", financialRoutes);
router.use("/reports", reportsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/settings", settingsRoutes);
router.use("/support", supportRoutes);
router.use("/integrations", integrationsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/marketing", marketingRoutes);
router.use("/promotion-package", promotionPackageRoutes);
router.use("/account-deactivations", accountDeactivationRoutes);
router.use("/content", contentAdminRoutes);
router.use("/role-definitions", roleDefinitionsRoutes);

export default router;
