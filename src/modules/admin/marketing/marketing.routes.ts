import { Router } from "express";
import { requireAdmin } from "../../../middleware/auth.middleware";
import {
  listEmailCampaignsHandler,
  createEmailCampaignHandler,
  listEmailTemplatesHandler,
  createEmailTemplateHandler,
  deleteEmailTemplateHandler,
  listPushNotificationsHandler,
  createPushNotificationHandler,
  listPushTemplatesHandler,
  createPushTemplateHandler,
  updatePushTemplateHandler,
  deletePushTemplateHandler,
  trafficSummaryHandler,
  listSeoKeywordsHandler,
  createSeoKeywordHandler,
  updateEmailTemplateHandler,
  deleteSeoKeywordHandler,
} from "./marketing.controller";

const router = Router();

router.get("/email-campaigns", requireAdmin, listEmailCampaignsHandler);
router.post("/email-campaigns", requireAdmin, createEmailCampaignHandler);
router.get("/email-templates", requireAdmin, listEmailTemplatesHandler);
router.post("/email-templates", requireAdmin, createEmailTemplateHandler);
router.put("/email-templates/:id", requireAdmin, updateEmailTemplateHandler);
router.delete("/email-templates/:id", requireAdmin, deleteEmailTemplateHandler);
router.get("/push-notifications", requireAdmin, listPushNotificationsHandler);
router.post("/push-notifications", requireAdmin, createPushNotificationHandler);
router.get("/push-templates", requireAdmin, listPushTemplatesHandler);
router.post("/push-templates", requireAdmin, createPushTemplateHandler);
router.put( "/push-templates/:id", requireAdmin, updatePushTemplateHandler);
router.delete("/push-templates/:id", requireAdmin, deletePushTemplateHandler);
router.get("/traffic-summary", requireAdmin, trafficSummaryHandler);
router.get("/seo-keywords", requireAdmin, listSeoKeywordsHandler);
router.post("/seo-keywords", requireAdmin, createSeoKeywordHandler);
router.delete("/seo-keywords/:id", requireAdmin, deleteSeoKeywordHandler);

export default router;
