"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const connections_controller_1 = require("./connections.controller");
const router = (0, express_1.Router)();
// All connection routes require authentication
router.use(auth_middleware_1.requireUser);
// POST /api/connections/request — send connection request (body: { receiverId })
router.post("/request", connections_controller_1.requestConnectionHandler);
// GET /api/connections/requests — list pending requests (received by current user)
// Must be before /:id so "requests" is not captured as id
router.get("/requests", connections_controller_1.getConnectionRequestsHandler);
// POST /api/connections/:id/accept — accept a connection request
router.post("/:id/accept", connections_controller_1.acceptConnectionHandler);
// POST /api/connections/:id/reject — reject a connection request
router.post("/:id/reject", connections_controller_1.rejectConnectionHandler);
// DELETE /api/connections/:id — cancel/remove connection
router.delete("/:id", connections_controller_1.deleteConnectionHandler);
// GET /api/connections — list my connections (accepted only)
router.get("/", connections_controller_1.getConnectionsHandler);
exports.default = router;
