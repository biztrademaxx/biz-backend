import { Router } from "express";
import {
  getExhibitorsHandler,
  getExhibitorHandler,
  updateExhibitorHandler,
  getExhibitorAnalyticsHandler,
  getExhibitorEventsHandler,
  getExhibitorPromotionsMarketingHandler,
  createExhibitorPromotionHandler,
  createExhibitorHandler,
  getExhibitorLeadsCountHandler,
  getExhibitorReviewsHandler,
  createExhibitorReviewHandler,
  createExhibitorReviewReplyHandler,
  getExhibitorProductsHandler,
  createExhibitorProductHandler,
  updateExhibitorProductHandler,
  deleteExhibitorProductHandler,
} from "./exhibitors.controller";
import { requireUser, optionalUser } from "../../middleware/auth.middleware";

const router = Router();

// List exhibitors
router.get("/exhibitors", getExhibitorsHandler);
// Create exhibitor (for Add Exhibitor flow)
router.post("/exhibitors", createExhibitorHandler);

// Must be before `/exhibitors/:id` so `promotions` is not captured as an id
router.get("/exhibitors/promotions", requireUser, getExhibitorPromotionsMarketingHandler);
router.post("/exhibitors/promotions", requireUser, createExhibitorPromotionHandler);

// Single exhibitor (GET + PUT for profile); optional JWT to view own private profile
router.get("/exhibitors/:id", optionalUser, getExhibitorHandler);
router.put("/exhibitors/:id", optionalUser, updateExhibitorHandler);

// Exhibitor analytics
router.get("/exhibitors/:id/analytics", getExhibitorAnalyticsHandler);

// Exhibitor events
router.get("/exhibitors/:exhibitorId/events", optionalUser, getExhibitorEventsHandler);

// Exhibitor leads count (follow + connect, for overview card)
router.get("/exhibitors/:id/leads-count", getExhibitorLeadsCountHandler);

// Exhibitor reviews (list, create, reply)
router.get("/exhibitors/:id/reviews", getExhibitorReviewsHandler);
router.post("/exhibitors/:id/reviews/:reviewId/replies", requireUser, createExhibitorReviewReplyHandler);
router.post("/exhibitors/:id/reviews", optionalUser, createExhibitorReviewHandler);

// Exhibitor products (list, create, update, delete); optional JWT so slug URLs resolve like GET /exhibitors/:id
router.get("/exhibitors/:id/products", optionalUser, getExhibitorProductsHandler);
router.post("/exhibitors/:id/products", optionalUser, createExhibitorProductHandler);
router.put("/exhibitors/:id/products/:productId", optionalUser, updateExhibitorProductHandler);
router.delete("/exhibitors/:id/products/:productId", optionalUser, deleteExhibitorProductHandler);

export default router;

