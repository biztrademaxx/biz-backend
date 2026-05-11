"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const marketing_controller_1 = require("./marketing.controller");
const router = (0, express_1.Router)();
router.get("/push-notifications", auth_middleware_1.requireUser, marketing_controller_1.listPushNotificationsHandler);
exports.default = router;
