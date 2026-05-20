"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const follow_controller_1 = require("./follow.controller");
const router = (0, express_1.Router)();
// More specific routes first
router.get("/followers/:userId/count", follow_controller_1.getFollowersCountHandler);
router.get("/followers/:userId", follow_controller_1.listFollowersHandler);
router.get("/stats/:userId", follow_controller_1.getFollowStatsHandler);
router.get("/following/:userId", follow_controller_1.listFollowingHandler);
// GET /api/follow/:userId — check if current user follows target (query: currentUserId optional)
router.get("/:userId", follow_controller_1.getFollowStatusHandler);
// POST /api/follow/:userId — follow user (auth required)
router.post("/:userId", auth_middleware_1.requireUser, follow_controller_1.followUserHandler);
// DELETE /api/follow/:userId — unfollow (auth required)
router.delete("/:userId", auth_middleware_1.requireUser, follow_controller_1.unfollowUserHandler);
exports.default = router;
