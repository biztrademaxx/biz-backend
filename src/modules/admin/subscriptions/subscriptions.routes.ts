// C:\bizz\biz-backend\src\modules\subscriptions\subscriptions.routes.ts

import { Router } from "express";
import { requireUser } from "../../../middleware/auth.middleware";
import {
  activateFreePlanHandler,
  activateSubscriptionHandler,
  createSubscriptionOrderHandler,
  getCurrentPlanHandler,
  getOrganizerPlansBatchHandler,
} from "./subscriptions.controller";

const router = Router();

router.get("/subscriptions/current", requireUser, getCurrentPlanHandler);
router.post("/subscriptions/create-order", requireUser, createSubscriptionOrderHandler);
router.post("/subscriptions/activate", requireUser, activateSubscriptionHandler);
router.post("/subscriptions/activate-free", requireUser, activateFreePlanHandler);

// NEW: Batch fetch organizer subscription plans
router.post("/subscriptions/batch", requireUser, getOrganizerPlansBatchHandler);

export default router;