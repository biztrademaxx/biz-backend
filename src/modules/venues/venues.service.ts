import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { cached, CACHE_TTL, venuesListCacheKey } from "../../config/redis";
import {
  canUserViewOwnPrivateProfile,
  publicPublishedEventWhere,
} from "../../utils/public-profile";
import {
  organizerCountryPriorityScore,
  type OrganizerCountryPriorityInput,
} from "../../utils/organizer-country-priority";

export interface ListVenuesParams {
  search?: string;
  page?: number;
  limit?: number;
  requireVenueImage?: boolean;
  /** Comma-separated venueCountry values. */
  country?: string;
  /** Comma-separated city names (venueCity / address). */
  city?: string;
  prioritizeCountry?: string;
  prioritizeCountryCode?: string;
  prioritizeCity?: string;
}

export async function listVenues(params: ListVenuesParams) {
  const key = await venuesListCacheKey(params as Record<string, unknown>);
  return cached(key, CACHE_TTL.VENUES_LIST, () => listVenuesFromDb(params));
}

const VENUE_LIST_MAX_LIMIT = 100;

const venuePublicListSelect = {
  id: true,
  venueName: true,
  venueAddress: true,
  venueCity: true,
  venueState: true,
  venueCountry: true,
  averageRating: true,
  totalReviews: true,
  avatar: true,
  venueImages: true,
} as const;

function buildPublicVenueListWhere(params: ListVenuesParams): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = [
    {
      role: "VENUE_MANAGER",
      NOT: { profileVisibility: "private" },
      isVerified: true,
    },
  ];
  if (params.requireVenueImage === true) {
    filters.push({ venueImages: { isEmpty: false } });
  }

  const search = params.search?.trim() ?? "";
  if (search) {
    filters.push({
      OR: [
        { venueName: { contains: search, mode: "insensitive" } },
        { venueDescription: { contains: search, mode: "insensitive" } },
        { venueAddress: { contains: search, mode: "insensitive" } },
        { venueCity: { contains: search, mode: "insensitive" } },
        { venueCountry: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const countries = String(params.country ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== "all");
  if (countries.length > 0) {
    filters.push({
      OR: countries.flatMap((country) => [
        { venueCountry: { equals: country, mode: "insensitive" } },
        { venueCountry: { contains: country, mode: "insensitive" } },
      ]),
    });
  }

  const cities = String(params.city ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== "all");
  if (cities.length > 0) {
    filters.push({
      OR: cities.flatMap((city) => [
        { venueCity: { contains: city, mode: "insensitive" } },
        { venueAddress: { contains: city, mode: "insensitive" } },
      ]),
    });
  }

  return filters.length === 1 ? filters[0]! : { AND: filters };
}

function mapVenueListRow(
  v: Prisma.UserGetPayload<{ select: typeof venuePublicListSelect }>,
) {
  const images = Array.isArray(v.venueImages) ? v.venueImages.slice(0, 4) : [];
  const addressParts = [v.venueAddress, v.venueCity, v.venueState, v.venueCountry].filter(Boolean);
  return {
    id: v.id,
    venueName: v.venueName || "Venue",
    name: v.venueName || "Venue",
    venueAddress: v.venueAddress || "",
    venueCity: v.venueCity || "",
    venueState: v.venueState || "",
    venueCountry: v.venueCountry || "",
    city: v.venueCity || "",
    state: v.venueState || "",
    country: v.venueCountry || "",
    address: addressParts.length > 0 ? addressParts.join(", ") : "",
    avatar: v.avatar,
    venueImages: images,
    images,
    averageRating: v.averageRating != null ? Number(v.averageRating) : 0,
    totalReviews: v.totalReviews != null ? Number(v.totalReviews) : 0,
    rating: v.averageRating != null ? Number(v.averageRating) : 0,
    reviewCount: v.totalReviews != null ? Number(v.totalReviews) : 0,
  };
}

async function listVenuesFromDb(params: ListVenuesParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit =
    params.limit && params.limit > 0
      ? Math.min(params.limit, VENUE_LIST_MAX_LIMIT)
      : 10;
  const skip = (page - 1) * limit;
  const where = buildPublicVenueListWhere(params);

  const priorityInput: OrganizerCountryPriorityInput = {
    countryName: String(params.prioritizeCountry ?? "").trim() || undefined,
    countryCode: String(params.prioritizeCountryCode ?? "").trim() || undefined,
    city: String(params.prioritizeCity ?? "").trim() || undefined,
  };
  const useGeoSort = Boolean(priorityInput.countryName || priorityInput.countryCode);

  let rows: Prisma.UserGetPayload<{ select: typeof venuePublicListSelect }>[];
  let total: number;

  if (useGeoSort) {
    const sortRows = await prisma.user.findMany({
      where,
      select: {
        id: true,
        venueCountry: true,
        venueCity: true,
        venueAddress: true,
        createdAt: true,
      },
    });
    const sorted = [...sortRows].sort((a, b) => {
      const scoreA = organizerCountryPriorityScore(
        {
          organizerCountry: a.venueCountry,
          organizerCity: a.venueCity,
          location: a.venueAddress,
        },
        priorityInput,
      );
      const scoreB = organizerCountryPriorityScore(
        {
          organizerCountry: b.venueCountry,
          organizerCity: b.venueCity,
          location: b.venueAddress,
        },
        priorityInput,
      );
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    total = sorted.length;
    const pageIds = sorted.slice(skip, skip + limit).map((r) => r.id);
    const fetched =
      pageIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: pageIds } },
            select: venuePublicListSelect,
          })
        : [];
    const byId = new Map(fetched.map((row) => [row.id, row]));
    rows = pageIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => !!row);
  } else {
    const [fetched, count] = await Promise.all([
      prisma.user.findMany({
        where,
        select: venuePublicListSelect,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);
    rows = fetched;
    total = count;
  }

  const transformedVenues = rows.map(mapVenueListRow);

  return {
    venues: transformedVenues,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
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
      where: {
        id,
        role: "VENUE_MANAGER",
        NOT: { profileVisibility: "private" },
        isVerified: true,
      },
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
    slug: event.slug,
    title: event.title,
    description: event.description,
    shortDescription: event.shortDescription,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    status: event.status,
    category: event.category,
    timezone: event.timezone,
    city: event.city,
    state: event.state,
    country: event.country,
    images: event.images,
    bannerImage: event.bannerImage,
    thumbnailImage: event.thumbnailImage,
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

export async function listVenueReviews(
  venueId: string,
  options?: { includeReplies?: boolean; viewerUserId?: string | null }
) {
  if (!venueId) {
    throw new Error("Invalid venue ID");
  }

  const venue = await prisma.user.findFirst({
    where: { id: venueId, role: "VENUE_MANAGER" },
    select: { id: true, isVerified: true },
  });
  if (!venue) {
    return [];
  }
  const isSelf = canUserViewOwnPrivateProfile(options?.viewerUserId ?? undefined, venueId);
  const publicListing = venue.isVerified;
  if (!publicListing && !isSelf) {
    return [];
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

  const venueRow = await prisma.user.findFirst({
    where: { id: venueId, role: "VENUE_MANAGER" },
    select: { id: true, isVerified: true },
  });
  if (!venueRow) {
    throw new Error("Venue not found");
  }
  if (!venueRow.isVerified) {
    throw new Error("This venue is not yet approved for public reviews");
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

