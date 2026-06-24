import { Router } from "express";
import { requireUser } from "../../middleware/auth.middleware";
import {
  activateFreePlanHandler,
  activateSubscriptionHandler,
  createSubscriptionOrderHandler,
  getCurrentPlanHandler,
} from "./subscriptions.controller";

const router = Router();

router.get("/subscriptions/current", requireUser, getCurrentPlanHandler);
router.post("/subscriptions/create-order", requireUser, createSubscriptionOrderHandler);
router.post("/subscriptions/activate", requireUser, activateSubscriptionHandler);
router.post("/subscriptions/activate-free", requireUser, activateFreePlanHandler);

export default router;
