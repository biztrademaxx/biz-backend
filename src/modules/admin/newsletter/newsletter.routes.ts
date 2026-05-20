import { Router } from "express";
import { requireAdmin } from "../../../middleware/auth.middleware";
import {
  adminListNewsletterSubscribers,
  adminListNewsletterRecentEvents,
  adminListNewsletterCampaigns,
  adminSendNewsletter,
} from "./newsletter.controller";

const router = Router();

router.get("/subscribers", requireAdmin, adminListNewsletterSubscribers);
router.get("/recent-events", requireAdmin, adminListNewsletterRecentEvents);
router.get("/campaigns", requireAdmin, adminListNewsletterCampaigns);
router.post("/send", requireAdmin, adminSendNewsletter);

export default router;
