"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.followUser = followUser;
exports.unfollowUser = unfollowUser;
exports.getIsFollowing = getIsFollowing;
exports.getFollowerIds = getFollowerIds;
exports.getFollowersCount = getFollowersCount;
exports.listFollowers = listFollowers;
exports.getFollowingCount = getFollowingCount;
exports.listFollowing = listFollowing;
const prisma_1 = __importDefault(require("../../config/prisma"));
/** Follow a user (e.g. follow an exhibitor). */
async function followUser(followerId, followingId) {
    if (followerId === followingId) {
        throw new Error("Cannot follow yourself");
    }
    const [follower, following] = await Promise.all([
        prisma_1.default.user.findUnique({ where: { id: followerId }, select: { id: true } }),
        prisma_1.default.user.findUnique({ where: { id: followingId }, select: { id: true } }),
    ]);
    if (!follower)
        throw new Error("Follower not found");
    if (!following)
        throw new Error("User to follow not found");
    const existing = await prisma_1.default.follow.findUnique({
        where: {
            followerId_followingId: { followerId, followingId },
        },
    });
    if (existing) {
        return { followed: true, already: true };
    }
    await prisma_1.default.follow.create({
        data: { followerId, followingId },
    });
    return { followed: true, already: false };
}
/** Unfollow a user. */
async function unfollowUser(followerId, followingId) {
    await prisma_1.default.follow.deleteMany({
        where: { followerId, followingId },
    });
    return { unfollowed: true };
}
/** Check if current user follows target user. */
async function getIsFollowing(followerId, followingId) {
    if (!followerId || !followingId || followerId === followingId)
        return false;
    const row = await prisma_1.default.follow.findUnique({
        where: {
            followerId_followingId: { followerId, followingId },
        },
    });
    return !!row;
}
/** List user IDs that follow the given user (e.g. exhibitor's followers). */
async function getFollowerIds(followingId) {
    const rows = await prisma_1.default.follow.findMany({
        where: { followingId },
        select: { followerId: true },
    });
    return rows.map((r) => r.followerId);
}
/** Count followers of a user. */
async function getFollowersCount(followingId) {
    return prisma_1.default.follow.count({
        where: { followingId },
    });
}
/** List followers with basic user info (for follow-management UI). */
async function listFollowers(followingId) {
    const rows = await prisma_1.default.follow.findMany({
        where: { followingId },
        include: {
            follower: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    jobTitle: true,
                    company: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
        id: r.follower.id,
        firstName: r.follower.firstName,
        lastName: r.follower.lastName,
        email: r.follower.email,
        avatar: r.follower.avatar,
        jobTitle: r.follower.jobTitle,
        company: r.follower.company,
        followedAt: r.createdAt.toISOString(),
    }));
}
/** Count users that this user follows. */
async function getFollowingCount(followerId) {
    return prisma_1.default.follow.count({
        where: { followerId },
    });
}
/** List users that this user follows (for follow-management UI). */
async function listFollowing(followerId) {
    const rows = await prisma_1.default.follow.findMany({
        where: { followerId },
        include: {
            following: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    jobTitle: true,
                    company: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
        id: r.following.id,
        firstName: r.following.firstName,
        lastName: r.following.lastName,
        email: r.following.email,
        avatar: r.following.avatar,
        jobTitle: r.following.jobTitle,
        company: r.following.company,
        followedAt: r.createdAt.toISOString(),
    }));
}
