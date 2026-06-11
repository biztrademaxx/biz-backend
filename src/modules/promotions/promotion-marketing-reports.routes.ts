import { Router } from "express";
import multer from "multer";
import { requireUser } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/auth.middleware";
import {
  deletePromotionMarketingReportHandler,
  listPromotionMarketingReportsHandler,
  uploadPromotionMarketingReportHandler,
} from "./promotion-marketing-reports.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** Organizer / exhibitor — view & download marketing lead reports */
export const promotionMarketingReportsUserRouter = Router();
promotionMarketingReportsUserRouter.get(
  "/:promotionId/marketing-reports",
  requireUser,
  listPromotionMarketingReportsHandler,
);

/** Admin — upload & manage daily lead reports */
export const promotionMarketingReportsAdminRouter = Router();
promotionMarketingReportsAdminRouter.get(
  "/:promotionId/marketing-reports",
  requireAdmin,
  listPromotionMarketingReportsHandler,
);
promotionMarketingReportsAdminRouter.post(
  "/:promotionId/marketing-reports",
  requireAdmin,
  upload.single("file"),
  uploadPromotionMarketingReportHandler,
);
promotionMarketingReportsAdminRouter.delete(
  "/:promotionId/marketing-reports/:reportId",
  requireAdmin,
  deletePromotionMarketingReportHandler,
);
