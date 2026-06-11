import { Router } from "express";
import { requireUser } from "../../middleware/auth.middleware";
import { listPromotionPackages, CANONICAL_PACKAGE_IDS } from "../admin/promotion-package/promotion-package.service";
import { getPromotionAudienceStats } from "./promotion-audience.service";

const router = Router();

router.get("/promotion-packages/audience-stats", requireUser, async (_req, res) => {
  try {
    const stats = await getPromotionAudienceStats();
    return res.json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch audience stats", details: error?.message });
  }
});

router.get("/promotion-packages", requireUser, async (req, res) => {
  try {
    const userType = typeof req.query.userType === "string" ? req.query.userType.toUpperCase() : undefined;
    const all = await listPromotionPackages();
    const packages = all.filter((pkg) => {
      if (!CANONICAL_PACKAGE_IDS.has(pkg.id)) return false;
      if (!pkg.isActive) return false;
      if (!userType) return true;
      return pkg.userType === "BOTH" || pkg.userType === userType;
    });
    return res.json({ packages });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch packages", details: error?.message });
  }
});

export default router;
