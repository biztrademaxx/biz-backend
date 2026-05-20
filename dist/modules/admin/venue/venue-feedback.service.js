"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVenueFeedbackForAdmin = listVenueFeedbackForAdmin;
exports.updateVenueFeedbackById = updateVenueFeedbackById;
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function listVenueFeedbackForAdmin() {
    const reviews = await prisma_1.default.review.findMany({
        where: { venueId: { not: null } },
        orderBy: { createdAt: "desc" },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
            },
            event: {
                select: { id: true, title: true },
            },
        },
    });
    const venueIds = [...new Set(reviews.map((r) => r.venueId).filter(Boolean))];
    const venues = venueIds.length > 0
        ? await prisma_1.default.user.findMany({
            where: { id: { in: venueIds } },
            select: {
                id: true,
                venueName: true,
                firstName: true,
                lastName: true,
                email: true,
                venueAddress: true,
                avatar: true,
            },
        })
        : [];
    const venueMap = new Map(venues.map((v) => [v.id, v]));
    const feedback = reviews.map((r) => {
        const venue = r.venueId ? venueMap.get(r.venueId) : null;
        return {
            id: r.id,
            venueId: r.venueId ?? "",
            venueName: (venue?.venueName ??
                `${venue?.firstName ?? ""} ${venue?.lastName ?? ""}`.trim()) ||
                "Venue",
            venueEmail: venue?.email ?? "",
            venueAddress: venue?.venueAddress ?? null,
            avatar: venue?.avatar ?? null,
            userName: r.user
                ? `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim() || "User"
                : "",
            userEmail: r.user?.email ?? "",
            eventName: r.event?.title ?? null,
            rating: r.rating ?? 0,
            title: r.title,
            comment: r.comment,
            isApproved: r.isApproved,
            createdAt: r.createdAt.toISOString(),
        };
    });
    const stats = {
        totalFeedback: feedback.length,
        pendingReviews: feedback.filter((f) => !f.isApproved).length,
        approvedFeedback: feedback.filter((f) => f.isApproved).length,
        averageRating: feedback.length > 0
            ? Number((feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1))
            : 0,
    };
    return { feedback, stats };
}
async function updateVenueFeedbackById(id, body) {
    const review = await prisma_1.default.review.findUnique({ where: { id } });
    if (!review)
        return null;
    const isApproved = body.action === "approve" || body.isApproved === true;
    await prisma_1.default.review.update({
        where: { id },
        data: { isApproved, ...(body.action === "reject" && { isPublic: false }) },
    });
    return { updated: true };
}
