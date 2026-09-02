import { Router } from "express";
import { requireAdmin } from "../../../middleware/auth.middleware";
import * as ctrl from "./exhibitors.controller";

const router = Router();

// Exhibitor feedback (admin) — must be before /:id
router.get("/exhibitor-feedback", requireAdmin, ctrl.listExhibitorFeedback);
router.patch("/exhibitor-feedback/:id", requireAdmin, ctrl.updateExhibitorFeedback);

// Exhibitor appointments (admin) — must be before /:id
router.get("/exhibitor-appointments", requireAdmin, ctrl.listExhibitorAppointments);
router.patch("/exhibitor-appointments/:id", requireAdmin, ctrl.updateExhibitorAppointmentStatus);

// Exhibitor promotions (admin) — before /:id
router.get("/promotions", requireAdmin, ctrl.listExhibitorPromotions);
router.get("/promotions/:id", requireAdmin, ctrl.getExhibitorPromotionById);
router.patch("/promotions/:id", requireAdmin, ctrl.patchExhibitorPromotion);

router.get("/stats", requireAdmin, ctrl.getStats);
router.get("/", requireAdmin, ctrl.list);
router.get("/:id", requireAdmin, ctrl.getById);
router.post("/", requireAdmin, ctrl.create);
router.post("/bulk-approve", requireAdmin, ctrl.bulkApprove);
router.patch("/:id", requireAdmin, ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);

export default router;
