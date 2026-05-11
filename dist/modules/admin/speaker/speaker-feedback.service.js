"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSpeakerFeedbackForAdmin = listSpeakerFeedbackForAdmin;
exports.updateSpeakerFeedbackById = updateSpeakerFeedbackById;
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function listSpeakerFeedbackForAdmin(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const speakerSessions = await prisma_1.default.speakerSession.findMany({
        select: { id: true, speakerId: true, title: true, eventId: true },
        skip,
        take: limit * 3,
    });
    const eventIds = [...new Set(speakerSessions.map((s) => s.eventId).filter(Boolean))];
    if (eventIds.length === 0) {
        return { feedback: [], stats: { totalFeedback: 0, pendingReviews: 0, approvedFeedback: 0, averageRating: 0 } };
    }
    const reviews = await prisma_1.default.review.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { createdAt: "desc" },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
            },
            event: {
                select: { id: true, title: true, thumbnailImage: true },
            },
        },
    });
    const feedback = await Promise.all(reviews.map(async (review) => {
        const session = speakerSessions.find((s) => s.eventId === review.eventId);
        if (!session)
            return null;
        const speaker = await prisma_1.default.user.findUnique({
            where: { id: session.speakerId },
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        });
        return {
            id: review.id,
            rating: review.rating ?? 0,
            title: review.title,
            comment: review.comment,
            isApproved: review.isApproved,
            isPublic: review.isPublic,
            createdAt: review.createdAt.toISOString(),
            updatedAt: review.updatedAt.toISOString(),
            speaker: speaker
                ? {
                    id: speaker.id,
                    firstName: speaker.firstName,
                    lastName: speaker.lastName,
                    email: speaker.email,
                    avatar: speaker.avatar,
                    name: `${speaker.firstName ?? ""} ${speaker.lastName ?? ""}`.trim() || "Unknown",
                }
                : {
                    id: session.speakerId,
                    firstName: "Unknown",
                    lastName: "Speaker",
                    email: "",
                    avatar: null,
                    name: "Unknown Speaker",
                },
            user: review.user
                ? {
                    id: review.user.id,
                    firstName: review.user.firstName,
                    lastName: review.user.lastName,
                    email: review.user.email,
                    avatar: review.user.avatar,
                    name: `${review.user.firstName ?? ""} ${review.user.lastName ?? ""}`.trim() || "Unknown",
                }
                : {
                    id: review.userId ?? "",
                    firstName: "Unknown",
                    lastName: "User",
                    email: "",
                    avatar: null,
                    name: "Unknown User",
                },
            event: review.event
                ? {
                    id: review.event.id,
                    title: review.event.title,
                    thumbnailImage: review.event.thumbnailImage,
                }
                : { id: review.eventId ?? "", title: "Unknown Event", thumbnailImage: null },
            sessionTitle: session.title,
        };
    }));
    const filtered = feedback.filter((f) => f !== null);
    const stats = {
        totalFeedback: filtered.length,
        pendingReviews: filtered.filter((f) => !f.isApproved).length,
        approvedFeedback: filtered.filter((f) => f.isApproved).length,
        averageRating: filtered.length > 0
            ? Number((filtered.reduce((s, f) => s + f.rating, 0) / filtered.length).toFixed(1))
            : 0,
    };
    return { feedback: filtered, stats };
}
async function updateSpeakerFeedbackById(id, body) {
    const review = await prisma_1.default.review.findUnique({ where: { id } });
    if (!review)
        return null;
    const data = {};
    if (body.isApproved !== undefined)
        data.isApproved = body.isApproved;
    if (body.isPublic !== undefined)
        data.isPublic = body.isPublic;
    await prisma_1.default.review.update({ where: { id }, data });
    const updated = await prisma_1.default.review.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
            event: { select: { id: true, title: true, thumbnailImage: true } },
        },
    });
    if (!updated)
        return null;
    const session = await prisma_1.default.speakerSession.findFirst({
        where: { eventId: updated.eventId ?? undefined },
        select: { speakerId: true, title: true },
    });
    const speaker = session
        ? await prisma_1.default.user.findUnique({
            where: { id: session.speakerId },
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        })
        : null;
    return {
        id: updated.id,
        rating: updated.rating ?? 0,
        title: updated.title,
        comment: updated.comment,
        isApproved: updated.isApproved,
        isPublic: updated.isPublic,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        speaker: speaker
            ? {
                id: speaker.id,
                firstName: speaker.firstName,
                lastName: speaker.lastName,
                email: speaker.email,
                avatar: speaker.avatar,
                name: `${speaker.firstName ?? ""} ${speaker.lastName ?? ""}`.trim() || "Unknown",
            }
            : { id: session?.speakerId ?? "", firstName: "", lastName: "", email: "", avatar: null, name: "Unknown" },
        user: updated.user
            ? {
                id: updated.user.id,
                firstName: updated.user.firstName,
                lastName: updated.user.lastName,
                email: updated.user.email,
                avatar: updated.user.avatar,
                name: `${updated.user.firstName ?? ""} ${updated.user.lastName ?? ""}`.trim() || "Unknown",
            }
            : { id: "", firstName: "", lastName: "", email: "", avatar: null, name: "Unknown" },
        event: updated.event
            ? { id: updated.event.id, title: updated.event.title, thumbnailImage: updated.event.thumbnailImage }
            : { id: "", title: "", thumbnailImage: null },
        sessionTitle: session?.title ?? "",
    };
}
