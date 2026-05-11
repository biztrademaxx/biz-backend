import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import {
  activePublicProfileUserWhere,
  canUserViewOwnPrivateProfile,
  publicPublishedEventWhere,
} from "../../utils/public-profile";

export interface ListVenuesParams {
  search?: string;
  page?: number;
  limit?: number;
  requireVenueImage?: boolean;
}

export async function listVenues(params: ListVenuesParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const skip = (page - 1) * limit;
  const requireVenueImage = params.requireVenueImage === true;

  const where: any = { role: "VENUE_MANAGER", ...activePublicProfileUserWhere() };
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
    prisma.user.findMany({
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
    prisma.user.count({ where }),
  ]);

  const sourceVenues = requireVenueImage
    ? venues.filter((v: any) => Array.isArray(v.venueImages) && v.venueImages.length > 0)
    : venues;

  const transformedVenues = sourceVenues.map((v: any) => {
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

export async function getVenueEvents(id: string, viewerUserId?: string | null) {
  if (!id) {
    throw new Error("Invalid venue ID");
  }

  const isSelf = canUserViewOwnPrivateProfile(viewerUserId ?? undefined, id);
  if (!isSelf) {
    const visible = await prisma.user.findFirst({
      where: { id, role: "VENUE_MANAGER", ...activePublicProfileUserWhere() },
      select: { id: true },
    });
    if (!visible) {
      return {
        success: true,
        events: [],
      };
    }
  }

  const eventWhere: Prisma.EventWhereInput = isSelf
    ? { venueId: id }
    : { AND: [{ venueId: id }, publicPublishedEventWhere()] };

  const events = await prisma.event.findMany({
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

export async function listVenueReviews(venueId: string, options?: { includeReplies?: boolean }) {
  if (!venueId) {
    throw new Error("Invalid venue ID");
  }

  let reviews: any[] = [];
  try {
    reviews = await prisma.review.findMany({
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
            orderBy: { createdAt: "asc" as const },
          },
        }),
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err: any) {
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
    replies: (review.replies ?? []).map((rep: any) => ({
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

export async function createVenueReview(params: {
  venueId: string;
  userId: string;
  rating: number;
  comment: string;
  title?: string | null;
}) {
  const { venueId, userId, rating, comment } = params;

  if (!venueId || !userId) {
    throw new Error("venueId and userId are required");
  }
  if (!rating || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const review = await prisma.review.create({
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
  const all = await prisma.review.findMany({
    where: { venueId, rating: { not: null } },
  });
  const totalReviews = all.length;
  const avg =
    totalReviews === 0
      ? 0
      : all.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews;

  await prisma.user.update({
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

export async function createVenueReviewReply(params: {
  venueId: string;
  reviewId: string;
  userId: string;
  content: string;
}) {
  const { venueId, reviewId, userId, content } = params;
  if (!venueId || !reviewId || !userId || !content?.trim()) {
    throw new Error("venueId, reviewId, userId and content are required");
  }
  const review = await prisma.review.findFirst({
    where: { id: reviewId, venueId },
  });
  if (!review) {
    throw new Error("Review not found or does not belong to this venue");
  }
  const reply = await prisma.reviewReply.create({
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

export async function deleteVenueReviewReply(params: {
  venueId: string;
  reviewId: string;
  replyId: string;
  userId: string;
}) {
  const { venueId, reviewId, replyId, userId } = params;
  if (!venueId || !reviewId || !replyId || !userId) {
    throw new Error("venueId, reviewId, replyId and userId are required");
  }
  const review = await prisma.review.findFirst({
    where: { id: reviewId, venueId },
  });
  if (!review) {
    throw new Error("Review not found or does not belong to this venue");
  }
  const reply = await prisma.reviewReply.findFirst({
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
  await prisma.reviewReply.delete({
    where: { id: replyId },
  });
}

