"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const newsletter_controller_1 = require("../modules/admin/newsletter/newsletter.controller");
const router = (0, express_1.Router)();
/** POST /api/newsletter/subscribe */
router.post("/newsletter/subscribe", newsletter_controller_1.publicNewsletterSubscribe);
exports.default = router;
