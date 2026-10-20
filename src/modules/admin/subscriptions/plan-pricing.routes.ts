import { Router } from "express";
import { requireAdmin, requirePermission } from "../../../middleware/auth.middleware";
import {
  listPricedCatalogPlans, updateOrganizerPlanPrice, PlanPriceError,
} from "../../subscriptions/plan-pricing.service";

const router = Router();
router.use(requireAdmin, requirePermission("subscription-plans"));
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/", async (_req, res) => {
  try {
    return res.json({ success: true, data: await listPricedCatalogPlans("ORGANIZER") });
  } catch (error) {
    console.error("List subscription plan prices:", error);
    return res.status(500).json({ message: "Unable to load subscription plan prices." });
  }
});

router.patch("/:slug", async (req, res) => {
  try {
    const plan = await updateOrganizerPlanPrice(req.params.slug, req.body?.amountInr, req.auth!);
    return res.json({ success: true, data: plan });
  } catch (error) {
    if (error instanceof PlanPriceError) return res.status(error.status).json({ message: error.message });
    console.error("Update subscription plan price:", error);
    return res.status(500).json({ message: "Unable to save the plan price. Please try again." });
  }
});

export default router;
