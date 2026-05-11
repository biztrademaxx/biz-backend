"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const venues_controller_1 = require("./venues.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// List venues
router.get("/venues", venues_controller_1.getVenuesHandler);
// Events for a specific venue (venue manager token sees all; public sees site-visible only)
router.get("/venues/:id/events", auth_middleware_1.optionalUser, venues_controller_1.getVenueEventsHandler);
// Reviews for a specific venue (reply routes before generic reviews)
router.post("/venues/:id/reviews/:reviewId/replies", auth_middleware_1.requireUser, venues_controller_1.createVenueReviewReplyHandler);
router.delete("/venues/:id/reviews/:reviewId/replies/:replyId", auth_middleware_1.requireUser, venues_controller_1.deleteVenueReviewReplyHandler);
router.get("/venues/:id/reviews", venues_controller_1.getVenueReviewsHandler);
router.post("/venues/:id/reviews", auth_middleware_1.requireUser, venues_controller_1.createVenueReviewHandler);
exports.default = router;
