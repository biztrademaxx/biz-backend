"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const speakers_controller_1 = require("./speakers.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// List speakers
router.get("/speakers", speakers_controller_1.getSpeakersHandler);
// Create speaker (event dashboard "Add new speaker")
router.post("/speakers", auth_middleware_1.requireUser, speakers_controller_1.postSpeakerHandler);
// Single speaker profile
router.get("/speakers/:id", speakers_controller_1.getSpeakerHandler);
// Update speaker profile (dashboard)
router.put("/speakers/:id", auth_middleware_1.requireUser, speakers_controller_1.putSpeakerHandler);
// Speaker events
router.get("/speakers/:id/events", auth_middleware_1.optionalUser, speakers_controller_1.getSpeakerEventsHandler);
// Speaker sessions (Presentation Materials)
router.get("/speakers/:id/sessions", speakers_controller_1.getSpeakerSessionsHandler);
exports.default = router;
