"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVenues = listVenues;
exports.getVenueEvents = getVenueEvents;
exports.listVenueReviews = listVenueReviews;
exports.createVenueReview = createVenueReview;
exports.createVenueReviewReply = createVenueReviewReply;
exports.deleteVenueReviewReply = deleteVenueReviewReply;
const prisma_1 = __importDefault(require("../../config/prisma"));
const public_profile_1 = require("../../utils/public-profile");
async function listVenues(params) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const skip = (page - 1) * limit;
    const requireVenueImage = params.requireVenueImage === true;
    const where = { role: "VENUE_MANAGER", ...(0, public_profile_1.activePublicProfileUserWhere)() };
    if (requireVenueImage) {
        where.venueImages = { isEmpty: false };
    }
    const search = params.search?.trim() ?? "";
    if (search) {
        where.OR = [
            { venueName: { contains: search, mode: "insensitive" } },
            { venueDescription: { contains: search, mode: "insensitive" } },
            { venueAddress: { contains: search, mode: "insensitive" } },
        ];
    }
    const [venues, total] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                organizerIdForVenueManager: true,
                venueName: true,
                venueDescription: true,
                venueAddress: true,
                venueCity: true,
                venueState: true,
                venueCountry: true,
                venueZipCode: true,
                maxCapacity: true,
                totalHalls: true,
                averageRating: true,
                totalReviews: true,
                amenities: true,
                venueCurrency: true,
                avatar: true,
                venueImages: true,
                venueTimezone: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: { venueEvents: true },
                },
            },
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma_1.default.user.count({ where }),
    ]);
    const sourceVenues = requireVenueImage
        ? venues.filter((v) => Array.isArray(v.venueImages) && v.venueImages.length > 0)
        : venues;
    const transformedVenues = sourceVenues.map((v) => {
        const images = Array.isArray(v.venueImages) ? v.venueImages : [];
        const addressParts = [v.venueAddress, v.venueCity, v.venueState, v.venueCountry].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(", ") : "";
        return {
            ...v,
            name: v.venueName || "Venue",
            images,
            eventCount: v._count?.venueEvents ?? 0,
            rating: v.averageRating != null ? Number(v.averageRating) : null,
            reviewCount: v.totalReviews != null ? Number(v.totalReviews) : 0,
            location: {
                address: v.venueAddress || "",
                city: v.venueCity || "",
                state: v.venueState || "",
                country: v.venueCountry || "",
                timezone: v.venueTimezone || "",
            },
            address,
        };
    });
    return {
        venues: transformedVenues,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
async function getVenueEvents(id, viewerUserId) {
    if (!id) {
        throw new Error("Invalid venue ID");
    }
    const isSelf = (0, public_profile_1.canUserViewOwnPrivateProfile)(viewerUserId ?? undefined, id);
    if (!isSelf) {
        const visible = await prisma_1.default.user.findFirst({
            where: { id, role: "VENUE_MANAGER", ...(0, public_profile_1.activePublicProfileUserWhere)() },
            select: { id: true },
        });
        if (!visible) {
            return {
                success: true,
                events: [],
            };
        }
    }
    const eventWhere = isSelf
        ? { venueId: id }
        : { AND: [{ venueId: id }, (0, public_profile_1.publicPublishedEventWhere)()] };
    const events = await prisma_1.default.event.findMany({
        where: eventWhere,
        include: {
            organizer: {
                select: {
                    firstName: true,
                    lastName: true,
                    company: true,
                    avatar: true,
                },
            },
        },
        orderBy: { startDate: "asc" },
    });
    const transformedEvents = events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        shortDescription: event.shortDescription,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        status: event.status,
        category: event.category,
        images: event.images,
        bannerImage: event.bannerImage,
        venueId: event.venueId,
        organizerId: event.organizerId,
        maxAttendees: event.maxAttendees,
        currentAttendees: event.currentAttendees,
        currency: event.currency,
        isVirtual: event.isVirtual,
        virtualLink: event.virtualLink,
        averageRating: event.averageRating,
        eventType: event.eventType,
        totalReviews: event.totalReviews,
        ticketTypes: true,
        organizer: event.organizer
            ? {
                name: `${event.organizer.firstName} ${event.organizer.lastName}`,
                organization: event.organizer.company || "Unknown Organization",
                avatar: event.organizer.avatar,
            }
            : undefined,
    }));
    return {
        success: true,
        events: transformedEvents,
    };
}
async function listVenueReviews(venueId, options) {
    if (!venueId) {
        throw new Error("Invalid venue ID");
    }
    let reviews = [];
    try {
        reviews = await prisma_1.default.review.findMany({
            where: { venueId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
                ...(options?.includeReplies && {
                    replies: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    avatar: true,
                                },
                            },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                }),
            },
            orderBy: { createdAt: "desc" },
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error loading venue reviews; returning empty list:", err);
        return [];
    }
    return reviews.map((review) => ({
        id: review.id,
        rating: review.rating ?? 0,
        title: "",
        comment: review.comment ?? "",
        createdAt: review.createdAt.toISOString(),
        isApproved: true,
        isPublic: true,
        user: review.user
            ? {
                id: review.user.id,
                firstName: review.user.firstName,
                lastName: review.user.lastName,
                avatar: review.user.avatar ?? null,
            }
            : { id: "", firstName: "Unknown", lastName: "User", avatar: null },
        replies: (review.replies ?? []).map((rep) => ({
            id: rep.id,
            content: rep.content,
            createdAt: rep.createdAt.toISOString(),
            isOrganizerReply: rep.isOrganizerReply,
            user: rep.user
                ? {
                    id: rep.user.id,
                    firstName: rep.user.firstName,
                    lastName: rep.user.lastName,
                    avatar: rep.user.avatar ?? null,
                }
                : null,
        })),
    }));
}
async function createVenueReview(params) {
    const { venueId, userId, rating, comment } = params;
    if (!venueId || !userId) {
        throw new Error("venueId and userId are required");
    }
    if (!rating || rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
    }
    const review = await prisma_1.default.review.create({
        data: {
            userId,
            venueId,
            rating,
            comment,
        },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                },
            },
        },
    });
    // recompute aggregates
    const all = await prisma_1.default.review.findMany({
        where: { venueId, rating: { not: null } },
    });
    const totalReviews = all.length;
    const avg = totalReviews === 0
        ? 0
        : all.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews;
    await prisma_1.default.user.update({
        where: { id: venueId },
        data: {
            averageRating: Math.round(avg * 10) / 10,
            totalReviews,
        },
    });
    return {
        id: review.id,
        rating: review.rating ?? 0,
        title: "",
        comment: review.comment ?? "",
        createdAt: review.createdAt.toISOString(),
        user: review.user && {
            id: review.user.id,
            firstName: review.user.firstName,
            lastName: review.user.lastName,
            avatar: review.user.avatar ?? null,
        },
    };
}
async function createVenueReviewReply(params) {
    const { venueId, reviewId, userId, content } = params;
    if (!venueId || !reviewId || !userId || !content?.trim()) {
        throw new Error("venueId, reviewId, userId and content are required");
    }
    const review = await prisma_1.default.review.findFirst({
        where: { id: reviewId, venueId },
    });
    if (!review) {
        throw new Error("Review not found or does not belong to this venue");
    }
    const reply = await prisma_1.default.reviewReply.create({
        data: {
            reviewId,
            userId,
            content: content.trim(),
            isOrganizerReply: true,
        },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                },
            },
        },
    });
    return {
        id: reply.id,
        content: reply.content,
        isOrganizerReply: reply.isOrganizerReply,
        createdAt: reply.createdAt.toISOString(),
        user: reply.user
            ? {
                id: reply.user.id,
                firstName: reply.user.firstName,
                lastName: reply.user.lastName,
                avatar: reply.user.avatar ?? null,
            }
            : null,
    };
}
async function deleteVenueReviewReply(params) {
    const { venueId, reviewId, replyId, userId } = params;
    if (!venueId || !reviewId || !replyId || !userId) {
        throw new Error("venueId, reviewId, replyId and userId are required");
    }
    const review = await prisma_1.default.review.findFirst({
        where: { id: reviewId, venueId },
    });
    if (!review) {
        throw new Error("Review not found or does not belong to this venue");
    }
    const reply = await prisma_1.default.reviewReply.findFirst({
        where: { id: replyId, reviewId },
    });
    if (!reply) {
        throw new Error("Reply not found");
    }
    const isVenueManager = userId === venueId;
    const isReplyAuthor = reply.userId === userId;
    if (!isVenueManager && !isReplyAuthor) {
        throw new Error("Only the reply author or venue manager can delete");
    }
    await prisma_1.default.reviewReply.delete({
        where: { id: replyId },
    });
}
