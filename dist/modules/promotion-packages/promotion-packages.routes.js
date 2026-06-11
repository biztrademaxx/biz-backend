"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const promotion_package_service_1 = require("../admin/promotion-package/promotion-package.service");
const promotion_audience_service_1 = require("./promotion-audience.service");
const router = (0, express_1.Router)();
router.get("/promotion-packages/audience-stats", auth_middleware_1.requireUser, async (_req, res) => {
    try {
        const stats = await (0, promotion_audience_service_1.getPromotionAudienceStats)();
        return res.json(stats);
    }
    catch (error) {
        return res.status(500).json({ error: "Failed to fetch audience stats", details: error?.message });
    }
});
router.get("/promotion-packages", auth_middleware_1.requireUser, async (req, res) => {
    try {
        const userType = typeof req.query.userType === "string" ? req.query.userType.toUpperCase() : undefined;
        const all = await (0, promotion_package_service_1.listPromotionPackages)();
        const packages = all.filter((pkg) => {
            if (!promotion_package_service_1.CANONICAL_PACKAGE_IDS.has(pkg.id))
                return false;
            if (!pkg.isActive)
                return false;
            if (!userType)
                return true;
            return pkg.userType === "BOTH" || pkg.userType === userType;
        });
        return res.json({ packages });
    }
    catch (error) {
        return res.status(500).json({ error: "Failed to fetch packages", details: error?.message });
    }
});
exports.default = router;
