"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
function canModerateReview(review, userId) {
    if (review.event?.organizerId === userId)
        return true;
    if (review.organizerId === userId)
        return true;
    if (review.venueId === userId)
        return true;
    return false;
}
/**
 * PATCH /api/reviews/:id/approve
 * Set isApproved = true. Caller must moderate this review (JWT).
 */
router.patch("/reviews/:id/approve", auth_middleware_1.requireUser, async (req, res) => {
    try {
        const reviewId = req.params.id;
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const review = await prisma_1.default.review.findUnique({
            where: { id: reviewId },
            include: { event: { select: { organizerId: true } } },
        });
        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }
        if (!canModerateReview(review, userId)) {
            return res.status(403).json({ error: "Not authorized to moderate this review" });
        }
        await prisma_1.default.review.update({
            where: { id: reviewId },
            data: { isApproved: true },
        });
        return res.json({ message: "Review approved successfully" });
    }
    catch (err) {
        console.error("Error approving review:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * DELETE /api/reviews/:id
 * Delete a review. Caller must moderate this review (JWT).
 */
router.delete("/reviews/:id", auth_middleware_1.requireUser, async (req, res) => {
    try {
        const reviewId = req.params.id;
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const review = await prisma_1.default.review.findUnique({
            where: { id: reviewId },
            include: { event: { select: { organizerId: true } } },
        });
        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }
        if (!canModerateReview(review, userId)) {
            return res.status(403).json({ error: "Not authorized to delete this review" });
        }
        await prisma_1.default.review.delete({
            where: { id: reviewId },
        });
        return res.json({ message: "Review deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting review:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * POST /api/reviews/:id/replies
 * Create a reply to a review. Caller must be the event organizer (JWT).
 */
router.post("/reviews/:id/replies", auth_middleware_1.requireUser, async (req, res) => {
    try {
        const reviewId = req.params.id;
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { content } = req.body;
        if (!content || !String(content).trim()) {
            return res.status(400).json({ error: "Reply content is required" });
        }
        const review = await prisma_1.default.review.findUnique({
            where: { id: reviewId },
            include: { event: { select: { organizerId: true } } },
        });
        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }
        const isEventOrganizer = review.event?.organizerId === userId;
        const isProfileOrganizer = review.organizerId === userId;
        if (!isEventOrganizer && !isProfileOrganizer) {
            return res.status(403).json({ error: "Only the organizer can reply" });
        }
        const reply = await prisma_1.default.reviewReply.create({
            data: {
                reviewId,
                userId,
                content: String(content).trim(),
                isOrganizerReply: true,
            },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, avatar: true },
                },
            },
        });
        return res.status(201).json({
            id: reply.id,
            content: reply.content,
            isOrganizerReply: reply.isOrganizerReply,
            createdAt: reply.createdAt.toISOString(),
            user: reply.user,
        });
    }
    catch (err) {
        console.error("Error creating review reply:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * GET /api/reviews/:id/replies
 * List replies for a review. Caller must be the event organizer (JWT).
 */
router.get("/reviews/:id/replies", auth_middleware_1.requireUser, async (req, res) => {
    try {
        const reviewId = req.params.id;
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const review = await prisma_1.default.review.findUnique({
            where: { id: reviewId },
            include: { event: { select: { organizerId: true } } },
        });
        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }
        if (!canModerateReview(review, userId)) {
            return res.status(403).json({ error: "Not authorized to view replies for this review" });
        }
        const replies = await prisma_1.default.reviewReply.findMany({
            where: { reviewId },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, avatar: true },
                },
            },
            orderBy: { createdAt: "asc" },
        });
        return res.json({
            replies: replies.map((r) => ({
                id: r.id,
                content: r.content,
                isOrganizerReply: r.isOrganizerReply,
                createdAt: r.createdAt.toISOString(),
                user: r.user,
            })),
        });
    }
    catch (err) {
        console.error("Error fetching review replies:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * DELETE /api/reviews/:id/replies/:replyId
 * Delete a reply. Caller must be event organizer or reply author (JWT).
 */
router.delete("/reviews/:id/replies/:replyId", auth_middleware_1.requireUser, async (req, res) => {
    try {
        const { id: reviewId, replyId } = req.params;
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const review = await prisma_1.default.review.findUnique({
            where: { id: reviewId },
            include: { event: { select: { organizerId: true } } },
        });
        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }
        const reply = await prisma_1.default.reviewReply.findUnique({
            where: { id: replyId },
        });
        if (!reply) {
            return res.status(404).json({ error: "Reply not found" });
        }
        if (reply.reviewId !== reviewId) {
            return res.status(400).json({ error: "Reply does not belong to this review" });
        }
        const isOrganizer = review.event?.organizerId === userId;
        const isAuthor = reply.userId === userId;
        if (!isOrganizer && !isAuthor) {
            return res.status(403).json({ error: "Not authorized to delete this reply" });
        }
        await prisma_1.default.reviewReply.delete({
            where: { id: replyId },
        });
        return res.json({ message: "Reply deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting review reply:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
