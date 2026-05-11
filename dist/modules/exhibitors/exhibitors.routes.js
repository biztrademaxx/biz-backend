"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exhibitors_controller_1 = require("./exhibitors.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// List exhibitors
router.get("/exhibitors", exhibitors_controller_1.getExhibitorsHandler);
// Create exhibitor (for Add Exhibitor flow)
router.post("/exhibitors", exhibitors_controller_1.createExhibitorHandler);
// Must be before `/exhibitors/:id` so `promotions` is not captured as an id
router.get("/exhibitors/promotions", auth_middleware_1.requireUser, exhibitors_controller_1.getExhibitorPromotionsMarketingHandler);
router.post("/exhibitors/promotions", auth_middleware_1.requireUser, exhibitors_controller_1.createExhibitorPromotionHandler);
// Single exhibitor (GET + PUT for profile); optional JWT to view own private profile
router.get("/exhibitors/:id", auth_middleware_1.optionalUser, exhibitors_controller_1.getExhibitorHandler);
router.put("/exhibitors/:id", exhibitors_controller_1.updateExhibitorHandler);
// Exhibitor analytics
router.get("/exhibitors/:id/analytics", exhibitors_controller_1.getExhibitorAnalyticsHandler);
// Exhibitor events
router.get("/exhibitors/:exhibitorId/events", auth_middleware_1.optionalUser, exhibitors_controller_1.getExhibitorEventsHandler);
// Exhibitor leads count (follow + connect, for overview card)
router.get("/exhibitors/:id/leads-count", exhibitors_controller_1.getExhibitorLeadsCountHandler);
// Exhibitor reviews (list, create, reply)
router.get("/exhibitors/:id/reviews", exhibitors_controller_1.getExhibitorReviewsHandler);
router.post("/exhibitors/:id/reviews/:reviewId/replies", auth_middleware_1.requireUser, exhibitors_controller_1.createExhibitorReviewReplyHandler);
router.post("/exhibitors/:id/reviews", auth_middleware_1.optionalUser, exhibitors_controller_1.createExhibitorReviewHandler);
// Exhibitor products (list, create, update, delete)
router.get("/exhibitors/:id/products", exhibitors_controller_1.getExhibitorProductsHandler);
router.post("/exhibitors/:id/products", exhibitors_controller_1.createExhibitorProductHandler);
router.put("/exhibitors/:id/products/:productId", exhibitors_controller_1.updateExhibitorProductHandler);
router.delete("/exhibitors/:id/products/:productId", exhibitors_controller_1.deleteExhibitorProductHandler);
exports.default = router;
