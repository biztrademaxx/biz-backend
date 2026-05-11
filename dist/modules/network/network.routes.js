"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const network_controller_1 = require("./network.controller");
const router = (0, express_1.Router)();
// GET /api/events/:eventId/network — event networking discovery (speakers, exhibitors, attendees, organizers)
router.get("/:eventId/network", auth_middleware_1.requireUser, network_controller_1.getEventNetworkHandler);
exports.default = router;
