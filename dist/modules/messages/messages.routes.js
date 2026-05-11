"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const messages_controller_1 = require("./messages.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireUser);
// POST /api/messages/read — mark conversation as read (body: { conversationId })
// Must be before /:conversationId so "read" is not captured
router.post("/read", messages_controller_1.markReadHandler);
// GET /api/messages/:conversationId — list messages in a conversation
router.get("/:conversationId", messages_controller_1.getMessagesHandler);
// POST /api/messages — send a message (body: { conversationId, content, type? })
router.post("/", messages_controller_1.postMessageHandler);
exports.default = router;
