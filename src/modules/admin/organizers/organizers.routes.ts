import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../../../middleware/auth.middleware";
import * as ctrl from "./organizers.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Organizer followers / connections (admin dashboard) — must be before /:id
// GET /api/admin/organizers/organizer-connections
router.get("/organizer-connections", requireAdmin, ctrl.listOrganizerConnections);
// GET /api/admin/organizers/organizer-connections/:id
router.get("/organizer-connections/:id", requireAdmin, ctrl.getOrganizerConnectionsDetail);

// Venue bookings (admin dashboard)
// GET /api/admin/organizers/venue-bookings
router.get("/venue-bookings", requireAdmin, ctrl.listVenueBookings);

// Organizer promotions (admin) — before /:id
router.get("/promotions", requireAdmin, ctrl.listOrganizerPromotions);
router.get("/promotions/:id", requireAdmin, ctrl.getOrganizerPromotionById);
router.patch("/promotions/:id", requireAdmin, ctrl.patchOrganizerPromotion);

// Base CRUD
router.get("/", requireAdmin, ctrl.list);
router.get("/:id", requireAdmin, ctrl.getById);
router.post("/", requireAdmin, ctrl.create);
router.post("/import", requireAdmin, upload.single("file"), ctrl.importBulk);
router.post("/send-account-email", requireAdmin, ctrl.sendAccountEmail);
router.patch("/:id", requireAdmin, ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);

export default router;
