"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followUserHandler = followUserHandler;
exports.unfollowUserHandler = unfollowUserHandler;
exports.getFollowStatusHandler = getFollowStatusHandler;
exports.getFollowersCountHandler = getFollowersCountHandler;
exports.listFollowersHandler = listFollowersHandler;
exports.getFollowStatsHandler = getFollowStatsHandler;
exports.listFollowingHandler = listFollowingHandler;
const follow_service_1 = require("./follow.service");
async function followUserHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const targetUserId = req.params.userId;
        if (!targetUserId) {
            return res.status(400).json({ error: "userId is required" });
        }
        const result = await (0, follow_service_1.followUser)(userId, targetUserId);
        return res.status(201).json({ success: true, ...result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("yourself") || message.includes("not found")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: "Failed to follow", details: message });
    }
}
async function unfollowUserHandler(req, res) {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const targetUserId = req.params.userId;
        if (!targetUserId) {
            return res.status(400).json({ error: "userId is required" });
        }
        await (0, follow_service_1.unfollowUser)(userId, targetUserId);
        return res.json({ success: true, unfollowed: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Failed to unfollow", details: message });
    }
}
async function getFollowStatusHandler(req, res) {
    try {
        const currentUserId = req.query.currentUserId || req.auth?.sub;
        const targetUserId = req.params.userId;
        if (!targetUserId) {
            return res.status(400).json({ error: "userId is required" });
        }
        const isFollowing = await (0, follow_service_1.getIsFollowing)(currentUserId || "", targetUserId);
        return res.json({ isFollowing });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Failed to get follow status", details: message });
    }
}
async function getFollowersCountHandler(req, res) {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        const count = await (0, follow_service_1.getFollowersCount)(userId);
        return res.json({ count, followers: count });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Failed to get followers count", details: message });
    }
}
async function listFollowersHandler(req, res) {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        const followers = await (0, follow_service_1.listFollowers)(userId);
        return res.json({ success: true, followers });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Failed to list followers", details: message });
    }
}
async function getFollowStatsHandler(req, res) {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        const [followersCount, followingCount] = await Promise.all([
            (0, follow_service_1.getFollowersCount)(userId),
            (0, follow_service_1.getFollowingCount)(userId),
        ]);
        return res.json({
            success: true,
            stats: { followersCount, followingCount },
            followers: followersCount,
            following: followingCount,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Failed to fetch follow stats", details: message });
    }
}
async function listFollowingHandler(req, res) {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        const following = await (0, follow_service_1.listFollowing)(userId);
        return res.json({ success: true, following });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Failed to list following", details: message });
    }
}
