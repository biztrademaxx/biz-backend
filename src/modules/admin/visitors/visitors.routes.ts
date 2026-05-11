import { Router } from "express";
import { requireAdmin } from "../../../middleware/auth.middleware";
import * as ctrl from "./visitors.controller";

const router = Router();

// Specific paths MUST come before generic paths like /:id
router.get("/categories", requireAdmin, ctrl.getAllCategories);
router.get("/visitor-events", requireAdmin, ctrl.listVisitorEvents);
router.get("/visitor-connections", requireAdmin, ctrl.listVisitorConnections);
router.get("/visitor-appointments", requireAdmin, ctrl.listVisitorAppointments);
router.get("/:id/suggestions/visitor", requireAdmin, ctrl.getVisitorForSuggestion);
router.get("/:id/suggestions/available", requireAdmin, ctrl.getAvailableExhibitors);
router.get("/:id/suggestions", requireAdmin, ctrl.getVisitorSuggestions);
router.post("/:id/suggestions/send", requireAdmin, ctrl.sendSuggestions);

// Generic routes
router.get("/", requireAdmin, ctrl.list);
router.get("/:id", requireAdmin, ctrl.getById);
router.patch("/:id", requireAdmin, ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);

export default router;