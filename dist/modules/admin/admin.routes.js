"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const admin_controller_1 = require("./admin.controller");
const events_controller_1 = require("../events/events.controller");
const event_import_controller_1 = require("./event-import/event-import.controller");
const organizers_routes_1 = __importDefault(require("./organizers/organizers.routes"));
const exhibitors_routes_1 = __importDefault(require("./exhibitors/exhibitors.routes"));
const speakers_routes_1 = __importDefault(require("./speakers/speakers.routes"));
const speaker_routes_1 = __importDefault(require("./speaker/speaker.routes"));
const venues_routes_1 = __importDefault(require("./venues/venues.routes"));
const venue_routes_1 = __importDefault(require("./venue/venue.routes"));
const visitors_routes_1 = __importDefault(require("./visitors/visitors.routes"));
const users_routes_1 = __importDefault(require("./users/users.routes"));
const sub_admins_routes_1 = __importDefault(require("./sub-admins/sub-admins.routes"));
const event_categories_routes_1 = __importDefault(require("./event-categories/event-categories.routes"));
const countries_routes_1 = __importDefault(require("./countries/countries.routes"));
const cities_routes_1 = __importDefault(require("./cities/cities.routes"));
const states_routes_1 = __importDefault(require("./states/states.routes"));
const upload_routes_1 = __importDefault(require("./upload/upload.routes"));
const financial_routes_1 = __importDefault(require("./financial/financial.routes"));
const reports_routes_1 = __importDefault(require("./reports/reports.routes"));
const notifications_routes_1 = __importDefault(require("./notifications/notifications.routes"));
const settings_routes_1 = __importDefault(require("./settings/settings.routes"));
const support_routes_1 = __importDefault(require("./support/support.routes"));
const integrations_routes_1 = __importDefault(require("./integrations/integrations.routes"));
const analytics_routes_1 = __importDefault(require("./analytics/analytics.routes"));
const marketing_routes_1 = __importDefault(require("./marketing/marketing.routes"));
const promotion_package_routes_1 = __importDefault(require("./promotion-package/promotion-package.routes"));
const account_deactivation_routes_1 = __importDefault(require("./account-deactivation/account-deactivation.routes"));
const content_routes_1 = __importDefault(require("./content/content.routes"));
const role_definitions_routes_1 = __importDefault(require("./role-definitions/role-definitions.routes"));
const router = (0, express_1.Router)();
const verifyBadgeUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});
const eventImportUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
// ─── Events (existing) ─────────────────────────────────────────────────────
router.get("/events/stats", auth_middleware_1.requireAdmin, admin_controller_1.adminGetEventStatsHandler);
router.get("/events", auth_middleware_1.requireAdmin, admin_controller_1.adminGetEventsHandler);
/** Bulk import — must be registered before `/events/:id` so `import` is not captured as :id */
router.post("/events/import", auth_middleware_1.requireAdmin, eventImportUpload.single("file"), event_import_controller_1.postEventImportHandler);
router.get("/events/import/:jobId", auth_middleware_1.requireAdmin, event_import_controller_1.getEventImportJobHandler);
router.post("/events/:id/verify", auth_middleware_1.requireAdmin, verifyBadgeUpload.single("badgeFile"), admin_controller_1.adminVerifyEventHandler);
router.get("/events/mail-candidates", auth_middleware_1.requireAdmin, admin_controller_1.adminGetEventMailCandidatesHandler);
router.post("/events/send-listing-email", auth_middleware_1.requireAdmin, admin_controller_1.adminSendEventListingEmailHandler);
router.get("/events/:id", auth_middleware_1.requireAdmin, admin_controller_1.adminGetEventByIdHandler);
router.patch("/events/:id", auth_middleware_1.requireAdmin, admin_controller_1.adminUpdateEventHandler);
router.delete("/events/:id", auth_middleware_1.requireAdmin, admin_controller_1.adminDeleteEventHandler);
router.post("/events", auth_middleware_1.requireAdmin, events_controller_1.createEventAdminHandler);
router.post("/events/approve", auth_middleware_1.requireAdmin, (0, auth_middleware_1.requirePermission)("approve_events"), admin_controller_1.adminApproveEventHandler);
router.post("/events/reject", auth_middleware_1.requireAdmin, (0, auth_middleware_1.requirePermission)("approve_events"), admin_controller_1.adminRejectEventHandler);
// ─── Dashboard ─────────────────────────────────────────────────────────────
router.get("/dashboard", auth_middleware_1.requireAdmin, admin_controller_1.adminGetDashboardHandler);
// ─── Resource modules ───────────────────────────────────────────────────────
router.use("/organizers", organizers_routes_1.default);
router.use("/exhibitors", exhibitors_routes_1.default);
router.use("/speakers", speakers_routes_1.default);
router.use("/speaker", speaker_routes_1.default);
router.use("/venues", venues_routes_1.default);
router.use("/venue", venue_routes_1.default);
router.use("/visitors", visitors_routes_1.default);
router.use("/users", users_routes_1.default);
router.use("/sub-admins", sub_admins_routes_1.default);
router.use("/event-categories", event_categories_routes_1.default);
router.use("/countries", countries_routes_1.default);
router.use("/states", states_routes_1.default);
router.use("/cities", cities_routes_1.default);
router.use("/upload", upload_routes_1.default);
router.use("/financial", financial_routes_1.default);
router.use("/reports", reports_routes_1.default);
router.use("/notifications", notifications_routes_1.default);
router.use("/settings", settings_routes_1.default);
router.use("/support", support_routes_1.default);
router.use("/integrations", integrations_routes_1.default);
router.use("/analytics", analytics_routes_1.default);
router.use("/marketing", marketing_routes_1.default);
router.use("/promotion-package", promotion_package_routes_1.default);
router.use("/account-deactivations", account_deactivation_routes_1.default);
router.use("/content", content_routes_1.default);
router.use("/role-definitions", role_definitions_routes_1.default);
exports.default = router;
