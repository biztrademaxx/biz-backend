"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const conversations_controller_1 = require("./conversations.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireUser);
// POST /api/conversations/start — start a conversation (body: { participantIds: string[] })
router.post("/start", conversations_controller_1.startConversationHandler);
// GET /api/conversations — list my conversations
router.get("/", conversations_controller_1.listConversationsHandler);
// GET /api/conversations/:id — get one conversation (must be participant)
router.get("/:id", conversations_controller_1.getConversationHandler);
exports.default = router;
