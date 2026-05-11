"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const promotion_package_service_1 = require("../admin/promotion-package/promotion-package.service");
const router = (0, express_1.Router)();
router.get("/promotion-packages", auth_middleware_1.requireUser, async (req, res) => {
    try {
        const userType = typeof req.query.userType === "string" ? req.query.userType.toUpperCase() : undefined;
        const all = await (0, promotion_package_service_1.listPromotionPackages)();
        const packages = all.filter((pkg) => {
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
