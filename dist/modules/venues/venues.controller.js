"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVenuesHandler = getVenuesHandler;
exports.getVenueEventsHandler = getVenueEventsHandler;
exports.getVenueReviewsHandler = getVenueReviewsHandler;
exports.createVenueReviewHandler = createVenueReviewHandler;
exports.createVenueReviewReplyHandler = createVenueReviewReplyHandler;
exports.deleteVenueReviewReplyHandler = deleteVenueReviewReplyHandler;
const venues_service_1 = require("./venues.service");
const prisma_1 = __importDefault(require("../../config/prisma"));
async function getVenuesHandler(req, res) {
    try {
        const search = req.query.search ?? "";
        const page = req.query.page ? Number.parseInt(req.query.page, 10) : undefined;
        const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : undefined;
        const requireVenueImage = req.query.requireVenueImage === "1" || req.query.requireVenueImage === "true";
        const { venues, pagination } = await (0, venues_service_1.listVenues)({ search, page, limit, requireVenueImage });
        return res.json({
            success: true,
            data: venues,
            pagination,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching venues (backend):", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch venues",
        });
    }
}
async function getVenueEventsHandler(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: "Invalid venue ID" });
        }
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const result = await (0, venues_service_1.getVenueEvents)(id, viewerId);
        return res.json(result);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("Invalid venue ID")) {
            return res.status(400).json({ success: false, error: "Invalid venue ID" });
        }
        // eslint-disable-next-line no-console
        console.error("Error fetching events by venue ID (backend):", error);
        return res.status(500).json({ success: false, error: "Server Error" });
    }
}
async function getVenueReviewsHandler(req, res) {
    try {
        const { id } = req.params;
        const includeReplies = req.query.includeReplies === "true";
        if (!id) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid venue ID" });
        }
        const reviews = await (0, venues_service_1.listVenueReviews)(id, { includeReplies });
        const payload = {
            success: true,
            reviews,
        };
        if (includeReplies) {
            const venueUser = await prisma_1.default.user.findUnique({
                where: { id },
                select: { id: true, venueName: true, company: true },
            });
            if (venueUser) {
                payload.venue = {
                    id: venueUser.id,
                    businessName: venueUser.venueName || venueUser.company || "Venue",
                };
            }
        }
        return res.json(payload);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching venue reviews (backend):", error);
        return res
            .status(500)
            .json({ success: false, error: "Failed to fetch reviews" });
    }
}
async function createVenueReviewHandler(req, res) {
    try {
        const { id } = req.params; // venueId
        const { rating, comment, title } = req.body ?? {};
        const userId = req.auth?.sub ?? req.body?.userId;
        if (!id) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid venue ID" });
        }
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, error: "Authentication required to submit a review" });
        }
        const review = await (0, venues_service_1.createVenueReview)({
            venueId: id,
            userId,
            rating,
            comment,
            title,
        });
        return res.status(201).json(review);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating venue review (backend):", error);
        return res
            .status(500)
            .json({ success: false, error: "Failed to create review" });
    }
}
async function createVenueReviewReplyHandler(req, res) {
    try {
        const { id: venueId, reviewId } = req.params;
        const userId = req.auth?.sub;
        const { content } = req.body ?? {};
        if (!venueId || !reviewId) {
            return res.status(400).json({ success: false, error: "Venue ID and review ID required" });
        }
        if (!userId) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        if (userId !== venueId) {
            return res.status(403).json({ success: false, error: "Only the venue manager can reply" });
        }
        if (!content || !String(content).trim()) {
            return res.status(400).json({ success: false, error: "Reply content is required" });
        }
        const reply = await (0, venues_service_1.createVenueReviewReply)({
            venueId,
            reviewId,
            userId,
            content: String(content).trim(),
        });
        return res.status(201).json(reply);
    }
    catch (error) {
        if (error?.message?.includes("not found")) {
            return res.status(404).json({ success: false, error: error.message });
        }
        // eslint-disable-next-line no-console
        console.error("Error creating venue review reply (backend):", error);
        return res.status(500).json({ success: false, error: "Failed to create reply" });
    }
}
async function deleteVenueReviewReplyHandler(req, res) {
    try {
        const { id: venueId, reviewId, replyId } = req.params;
        const userId = req.auth?.sub;
        if (!venueId || !reviewId || !replyId) {
            return res.status(400).json({ success: false, error: "Venue ID, review ID and reply ID required" });
        }
        if (!userId) {
            return res.status(401).json({ success: false, error: "Authentication required" });
        }
        await (0, venues_service_1.deleteVenueReviewReply)({ venueId, reviewId, replyId, userId });
        return res.json({ message: "Reply deleted successfully" });
    }
    catch (error) {
        if (error?.message?.includes("not found")) {
            return res.status(404).json({ success: false, error: error.message });
        }
        // eslint-disable-next-line no-console
        console.error("Error deleting venue review reply (backend):", error);
        return res.status(500).json({ success: false, error: "Failed to delete reply" });
    }
}
