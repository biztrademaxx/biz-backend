"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conferences_controller_1 = require("./conferences.controller");
const router = (0, express_1.Router)();
// List conferences for an event (must be before /:id)
router.get("/conferences", conferences_controller_1.listConferencesHandler);
router.post("/conferences", conferences_controller_1.createConferenceHandler);
// Single conference
router.get("/conferences/:id", conferences_controller_1.getConferenceHandler);
router.put("/conferences/:id", conferences_controller_1.updateConferenceHandler);
router.delete("/conferences/:id", conferences_controller_1.deleteConferenceHandler);
exports.default = router;
