import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import {
  publicPublishedEventWhere,
  activePublicProfileUserWhere,
  canBypassEventPrivacy,
  isEventPubliclyVisible,
} from "../../utils/public-profile";
import { getPublicProfileSlug } from "../../utils/profile-slug";

const statusMap: Record<string, string> = {
  PUBLISHED: "Approved",
  PENDING_APPROVAL: "Pending Review",
  DRAFT: "Draft",
  CANCELLED: "Flagged",
  REJECTED: "Rejected",
  COMPLETED: "Approved",
};

function trimOrganizerEventText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export interface ListEventsParams {
  page?: number;
  limit?: number;
  category?: string | null;
  search?: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  featured?: boolean;
  sort?: string;
  verified?: boolean;
  vip?: boolean;
}

export async function listEvents(params: ListEventsParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 12;
  const skip = (page - 1) * limit;

  const andParts: Prisma.EventWhereInput[] = [publicPublishedEventWhere()];

  if (params.category) {
    andParts.push({ category: { has: params.category } });
  }

  const search = params.search?.trim() ?? "";
  if (search) {
    andParts.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { shortDescription: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ],
    });
  }

  if (params.location) {
    const location = params.location.trim();
    if (location) {
      andParts.push({
        venue: {
          OR: [
            { venueCity: { contains: location, mode: "insensitive" } },
            { venueState: { contains: location, mode: "insensitive" } },
            { venueCountry: { contains: location, mode: "insensitive" } },
          ],
        },
      });
    }
  }

  if (params.startDate) {
    andParts.push({ startDate: { gte: new Date(params.startDate) } });
  }

  if (params.endDate) {
    andParts.push({ endDate: { lte: new Date(params.endDate) } });
  }

  if (params.featured) {
    andParts.push({ isFeatured: true });
  }

  if (params.verified) {
    andParts.push({ isVerified: true });
  }

  if (params.vip) {
    andParts.push({ isVIP: true });
  }

  const where: Prisma.EventWhereInput = { AND: andParts };

  let orderBy: any = {};
  switch (params.sort) {
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    case "soonest":
      orderBy = { startDate: "asc" };
      break;
    case "popular":
      orderBy = { currentAttendees: "desc" };
      break;
    case "featured":
      orderBy = [{ isFeatured: "desc" }, { createdAt: "desc" }];
      break;
    case "verified":
      orderBy = [{ isVerified: "desc" }, { createdAt: "desc" }];
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      omit: {
        description: true,
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        venue: {
          select: {
            id: true,
            venueName: true,
            venueCity: true,
            venueState: true,
            venueCountry: true,
            venueAddress: true,
          },
        },
        ticketTypes: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            quantity: true,
          },
          orderBy: { price: "asc" as const },
          take: 1,
        },
        _count: {
          select: {
            registrations: {
              where: { status: "CONFIRMED" },
            },
            reviews: true,
            savedEvents: true,
          },
        },
        savedEvents: {
          orderBy: { savedAt: "desc" },
          take: 3,
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  const transformedEvents = events.map((event: any) => {
    const cheapestTicket = event.ticketTypes[0]?.price || 0;

    return {
      id: event.id,
      title: event.title,
      /** Full body omitted at DB layer for listing — cards use short text only. */
      description: event.shortDescription ?? "",
      shortDescription: event.shortDescription,
      subTitle: event.subTitle ?? null,
      edition: event.edition,
      slug: event.slug,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      timezone: event.timezone,
      location: event.venue?.venueName || "Virtual Event",
      city: event.venue?.venueCity || "",
      state: event.venue?.venueState || "",
      country: event.venue?.venueCountry || "",
      address: event.venue?.venueAddress || "",
      venue: event.venue
        ? {
            venueName: event.venue.venueName,
            venueCity: event.venue.venueCity,
            venueState: event.venue.venueState,
            venueCountry: event.venue.venueCountry,
            venueAddress: event.venue.venueAddress,
          }
        : null,
      isVirtual: event.isVirtual,
      virtualLink: event.virtualLink,
      status: statusMap[event.status] || "Pending Review",
      category: event.category || [],
      tags: event.tags || [],
      eventType: event.eventType || [],
      isFeatured: event.isFeatured,
      isVIP: event.isVIP,
      isVerified: event.isVerified || false,
      verifiedAt: event.verifiedAt?.toISOString() ?? null,
      verifiedBy: event.verifiedBy || "",
      verifiedBadgeImage: event.verifiedBadgeImage ?? null,
      attendees: event._count.registrations,
      totalReviews: event._count.reviews,
      followersCount: event._count.savedEvents ?? 0,
      followerPreview: Array.isArray(event.savedEvents)
        ? event.savedEvents.map((se: { user: { id: string; firstName: string; lastName: string; avatar: string | null } }) => ({
            id: se.user.id,
            firstName: se.user.firstName,
            lastName: se.user.lastName,
            avatar: se.user.avatar ?? null,
          }))
        : [],
      averageRating: Number(event.averageRating ?? 0),
      cheapestTicket,
      currency: event.currency,
      images: event.images,
      videos: event.videos ?? [],
      bannerImage: event.bannerImage,
      thumbnailImage: event.thumbnailImage,
      youtubeVideoUrl: event.youtubeVideoUrl ?? null,
      organizer: {
        id: event.organizer.id,
        name: `${event.organizer.firstName} ${event.organizer.lastName}`.trim(),
        email: event.organizer.email,
        avatar: event.organizer.avatar,
      },
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  });

  return {
    events: transformedEvents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

// Featured events — same venue/location shape as listEvents so home cards get city/country.
export async function getFeaturedEvents() {
  const events = await prisma.event.findMany({
    where: {
      AND: [{ isFeatured: true }, publicPublishedEventWhere()],
    },
    include: {
      venue: {
        select: {
          venueName: true,
          venueCity: true,
          venueState: true,
          venueCountry: true,
          venueAddress: true,
        },
      },
    },
    orderBy: { startDate: "asc" as const },
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    slug: event.slug,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    bannerImage: event.bannerImage,
    images: event.images,
    edition: event.edition,
    tags: event.tags,
    eventType: event.eventType,
    categories: event.category,
    averageRating: event.averageRating,
    totalReviews: event.totalReviews,
    venue: event.venue
      ? {
          venueName: event.venue.venueName,
          venueAddress: event.venue.venueAddress,
          venueCity: event.venue.venueCity,
          venueCountry: event.venue.venueCountry,
        }
      : null,
    isVirtual: event.isVirtual,
  }));
}

// Event detail helpers (PostgreSQL: id is uuid; lookup by id or slug/title)
function isEventIdUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export async function getEventByIdentifier(id: string, viewerUserId?: string | null) {
  if (!id?.trim()) {
    throw new Error("Invalid event identifier");
  }

  const trimmed = id.trim();

  const include = {
    organizer: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        organizationName: true,
        company: true,
        description: true,
        phone: true,
        totalEvents: true,
        averageRating: true,
        totalReviews: true,
        createdAt: true,
        isActive: true,
        profileVisibility: true,
      },
    },
    venue: true,
    leads: true,
    ticketTypes: {
      where: { isActive: true },
      orderBy: { price: "asc" as const },
    },
    speakerSessions: {
      include: {
        speaker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            company: true,
            jobTitle: true,
            isActive: true,
            profileVisibility: true,
          },
        },
      },
      orderBy: { startTime: "asc" as const },
    },
    exhibitionSpaces: { where: { isAvailable: true } },
    _count: { select: { registrations: true, reviews: true } },
  };

  let event: any = null;

  if (isEventIdUuid(trimmed)) {
    event = await prisma.event.findUnique({
      where: { id: trimmed },
      include,
    });
  }

  if (!event) {
    event = await prisma.event.findUnique({
      where: { slug: trimmed },
      include,
    });
  }

  const slugOrTitle = trimmed.replace(/-/g, " ").trim();
  if (!event) {
    event = await prisma.event.findFirst({
      where: {
        OR: [
          { slug: { contains: slugOrTitle, mode: "insensitive" } },
          { title: { equals: slugOrTitle, mode: "insensitive" } },
          { title: { contains: slugOrTitle, mode: "insensitive" } },
        ],
      },
      include,
    });
  }

  if (!event) {
    return null;
  }

  if (
    !canBypassEventPrivacy(viewerUserId ?? undefined, {
      organizerId: event.organizerId,
      venueId: event.venueId,
    }) &&
    !isEventPubliclyVisible({
      organizerId: event.organizerId,
      venueId: event.venueId,
      organizer: event.organizer,
      venue: event.venue,
    })
  ) {
    return null;
  }

  const availableTickets =
    event.ticketTypes?.reduce(
      (total: number, ticket: { quantity: number; sold: number }) => total + (ticket.quantity - ticket.sold),
      0,
    ) ?? 0;

  const slug = event.slug || generateSlug(event.title);

  // Map venue to frontend shape: keep address/geo fields for public event pages + dashboard extras.
  // (Previously we only sent `company`/`bio`/joined `location`, so `venueAddress` was missing and UIs showed "Location TBA".)
  const venue = event.venue
    ? {
        id: event.venue.id,
        venueName: event.venue.venueName,
        venueAddress: event.venue.venueAddress,
        venueCity: event.venue.venueCity,
        venueState: event.venue.venueState,
        venueCountry: event.venue.venueCountry,
        venueZipCode: event.venue.venueZipCode,
        venuePhone: event.venue.venuePhone,
        venueEmail: event.venue.venueEmail,
        venueWebsite: event.venue.venueWebsite,
        venueDescription: event.venue.venueDescription,
        organizationName: event.venue.organizationName,
        latitude: event.venue.latitude,
        longitude: event.venue.longitude,
        amenities: event.venue.amenities ?? [],
        venueImages: event.venue.venueImages ?? [],
        company: event.venue.company ?? event.venue.organizationName ?? event.venue.venueName ?? "",
        bio: event.venue.bio ?? event.venue.venueDescription ?? "",
        location:
          ([event.venue.venueAddress, event.venue.venueCity, event.venue.venueState, event.venue.venueCountry]
            .filter(Boolean)
            .join(", ") ||
            event.venue.location) ??
          "",
        website: event.venue.venueWebsite ?? event.venue.website ?? "",
      }
    : null;

  // Match GET /organizers/:id — User.totalEvents/activeEvents are often stale; counts must come from Event rows.
  let organizerEventCounts: { totalEvents: number; activeEvents: number } | null = null;
  if (event.organizerId && event.organizer) {
    const [allEv, publishedEv] = await Promise.all([
      prisma.event.aggregate({
        where: { organizerId: event.organizerId },
        _count: { id: true },
      }),
      prisma.event.aggregate({
        where: { organizerId: event.organizerId, status: "PUBLISHED" },
        _count: { id: true },
      }),
    ]);
    organizerEventCounts = {
      totalEvents: allEv._count.id,
      activeEvents: publishedEv._count.id,
    };
  }

  const organizerPublic = event.organizer
    ? {
        ...event.organizer,
        publicSlug: getPublicProfileSlug(
          {
            role: "ORGANIZER",
            firstName: event.organizer.firstName,
            lastName: event.organizer.lastName,
            organizationName: event.organizer.organizationName,
            company: event.organizer.company,
          },
          "ORGANIZER",
        ),
        ...(organizerEventCounts && {
          totalEvents: organizerEventCounts.totalEvents,
          activeEvents: organizerEventCounts.activeEvents,
        }),
      }
    : null;

  const data = {
    ...event,
    title: event.title || "Untitled Event",
    description: event.description || event.shortDescription || "",
    subTitle: event.subTitle ?? null,
    edition: event.edition || null,
    availableTickets,
    isAvailable: availableTickets > 0 && new Date() < event.registrationEnd,
    registrationCount: event._count?.registrations ?? 0,
    reviewCount: event._count?.reviews ?? 0,
    layoutPlan: event.layoutPlan,
    slug,
    venue,
    ...(organizerPublic ? { organizer: organizerPublic } : {}),
    metadata: {
      title: event.title,
      description: event.description || event.shortDescription,
      image: event.bannerImage || event.images?.[0] || null,
      tags: event.tags || [],
      category: event.category || "General",
    },
  };

  const bypassAgenda = canBypassEventPrivacy(viewerUserId ?? undefined, {
    organizerId: event.organizerId,
    venueId: event.venueId,
  });
  if (!bypassAgenda && Array.isArray(data.speakerSessions)) {
    data.speakerSessions = data.speakerSessions.filter((row: any) => {
      const sp = row?.speaker;
      return sp && sp.isActive !== false && sp.profileVisibility !== "private";
    });
  }

  return data;
}

// Events stats (categories only, matching ?stats=true behavior)
const ALL_CATEGORIES = [
  "Education & Training",
  "Medical & Pharma",
  "IT & Technology",
  "Banking & Finance",
  "Business Services",
  "Industrial Engineering",
  "Building & Construction",
  "Power & Energy",
  "Entertainment & Media",
  "Wellness, Health & Fitness",
  "Science & Research",
  "Environment & Waste",
  "Agriculture & Forestry",
  "Food & Beverages",
  "Logistics & Transportation",
  "Electric & Electronics",
  "Arts & Crafts",
  "Auto & Automotive",
  "Home & Office",
  "Security & Defense",
  "Fashion & Beauty",
  "Travel & Tourism",
  "Telecommunication",
  "Apparel & Clothing",
  "Animals & Pets",
  "Baby, Kids & Maternity",
  "Hospitality",
  "Packing & Packaging",
  "Miscellaneous",
];

export async function getCategoryStats() {
  const categoryCounts = await Promise.all(
    ALL_CATEGORIES.map(async (category) => {
      const count = await prisma.event.count({
        where: {
          AND: [publicPublishedEventWhere(), { category: { has: category } }],
        },
      });
      return { category, count };
    }),
  );

  const filteredCounts = categoryCounts.filter((item) => item.count > 0);

  return {
    categories: filteredCounts,
    totalCategories: filteredCounts.length,
  };
}

// Extended stats (cities/countries/categories) – mirrors app/api/events/stats

export interface EventStatsOptions {
  includeCategories?: boolean;
  includeCities?: boolean;
  includeCountries?: boolean;
}

export async function getEventStats(options: EventStatsOptions) {
  const includeCategories = options.includeCategories ?? true;
  const includeCities = options.includeCities ?? false;
  const includeCountries = options.includeCountries ?? false;

  const result: any = {
    success: true,
  };

  if (includeCategories) {
    const { categories, totalCategories } = await getCategoryStats();
    result.categories = categories.sort((a: any, b: any) => b.count - a.count);
    result.totalCategories = totalCategories;
  }

  if (includeCities) {
    const cityRows = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    });

    const cityCounts = await Promise.all(
      cityRows.map(async (cityRow) => {
        const city = cityRow.name;
        const count = await prisma.event.count({
          where: {
            AND: [
              publicPublishedEventWhere(),
              {
                venue: {
                  is: {
                    AND: [
                      activePublicProfileUserWhere(),
                      { venueCity: { contains: city, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        });
        return { city, count };
      }),
    );

    const filteredCities = cityCounts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
    result.cities = filteredCities;
    result.totalCities = filteredCities.length;
  }

  if (includeCountries) {
    const countryRows = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true, code: true },
    });

    const countryCounts = await Promise.all(
      countryRows.map(async (countryRow) => {
        const country = countryRow.name;
        const count = await prisma.event.count({
          where: {
            status: "PUBLISHED",
            isPublic: true,
            venue: {
              OR: [
                {
                  venueCountry: {
                    contains: countryRow.name,
                    mode: "insensitive",
                  },
                },
                {
                  venueCountry: {
                    contains: countryRow.code,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        });
        return { country, count };
      }),
    );

    const filteredCountries = countryCounts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
    result.countries = filteredCountries;
    result.totalCountries = filteredCountries.length;
  }

  return result;
}

// Search service – mirrors app/api/search/route.ts
export async function searchEntities(query: string, limit = 5) {
  const trimmed = query.trim();

  if (!trimmed || trimmed.length < 2) {
    return {
      events: [],
      venues: [],
      speakers: [],
      allResults: [],
    };
  }

  const [events, venues, speakers] = await Promise.all([
    prisma.event.findMany({
      where: {
        AND: [
          publicPublishedEventWhere(),
          { title: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        startDate: true,
        isVIP: true,
        isFeatured: true,
        venue: {
          select: {
            venueCity: true,
            venueCountry: true,
          },
        },
      },
      orderBy: { startDate: "asc" as const },
      take: limit,
    }),

    prisma.user.findMany({
      where: {
        role: "VENUE_MANAGER",
        venueName: { contains: trimmed, mode: "insensitive" },
        ...activePublicProfileUserWhere(),
      },
      select: {
        id: true,
        venueName: true,
        venueCity: true,
        venueCountry: true,
      },
      take: limit,
    }),

    prisma.user.findMany({
      where: {
        role: "SPEAKER",
        OR: [
          { firstName: { contains: trimmed, mode: "insensitive" } },
          { lastName: { contains: trimmed, mode: "insensitive" } },
        ],
        ...activePublicProfileUserWhere(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      take: limit,
    }),
  ]);

  const eventResults = events.map((event: any) => ({
    id: event.id,
    title: event.title,
    slug: event.slug,
    startDate: event.startDate,
    isVIP: event.isVIP,
    isFeatured: event.isFeatured,
    venue: event.venue,
    type: "event" as const,
  }));

  const venueResults = venues.map((venue: any) => ({
    id: venue.id,
    venueName: venue.venueName,
    location: [venue.venueCity, venue.venueCountry].filter(Boolean).join(", "),
    type: "venue" as const,
  }));

  const speakerResults = speakers.map((speaker: any) => ({
    id: speaker.id,
    displayName: `${speaker.firstName} ${speaker.lastName}`,
    type: "speaker" as const,
  }));

  const allResults = [
    ...eventResults.map((e: any) => ({ ...e, resultType: "event" as const })),
    ...venueResults.map((v: any) => ({ ...v, resultType: "venue" as const })),
    ...speakerResults.map((s: any) => ({ ...s, resultType: "speaker" as const })),
  ];

  return {
    events: eventResults,
    venues: venueResults,
    speakers: speakerResults,
    allResults,
  };
}

// Simple helpers for additional event endpoints

export async function listRecentEvents(limit = 10) {
  const result = await listEvents({
    page: 1,
    limit,
    sort: "newest",
  });
  return result.events;
}

export async function listVipEvents(limit = 10) {
  const result = await listEvents({
    page: 1,
    limit,
    sort: "newest",
    vip: true,
  });
  return result.events;
}

// ----- Event sub-resources (leads, exhibitors, speakers, brochure, layout, space-costs) -----

export async function listEventLeads(eventId: string) {
  const leads = await prisma.eventLead.findMany({
    where: { eventId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
          jobTitle: true,
          avatar: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          images: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return leads;
}

/** List only attendee-type leads for an event (for Attendees Management dashboard). */
export async function listEventAttendees(eventId: string) {
  const leads = await prisma.eventLead.findMany({
    where: { eventId, type: "attendee", userId: { not: null } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
          jobTitle: true,
          avatar: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          images: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return leads.map((lead) => ({
    id: lead.id,
    status: lead.status ?? "NEW",
    notes: lead.notes ?? undefined,
    createdAt: lead.createdAt.toISOString(),
    user: lead.user
      ? {
          id: lead.user.id,
          firstName: lead.user.firstName,
          lastName: lead.user.lastName,
          email: lead.user.email,
          phone: lead.user.phone ?? undefined,
          company: lead.user.company ?? undefined,
          jobTitle: lead.user.jobTitle ?? undefined,
          avatar: lead.user.avatar ?? undefined,
        }
      : null,
    event: lead.event
      ? {
          id: lead.event.id,
          title: lead.event.title,
          startDate: lead.event.startDate instanceof Date ? lead.event.startDate.toISOString() : lead.event.startDate,
          images: lead.event.images ?? [],
        }
      : null,
  }));
}

// Create or reuse an event lead (user interest in event)
export async function createEventLead(args: {
  eventId: string;
  userId: string;
  type: string;
}) {
  const { eventId, userId, type } = args;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    return { error: "EVENT_NOT_FOUND" as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return { error: "USER_NOT_FOUND" as const };
  }

  const existing = await prisma.eventLead.findFirst({
    where: {
      eventId,
      userId,
      type,
    },
  });

  if (existing) {
    return {
      success: true as const,
      alreadyExists: true as const,
      lead: existing,
      message: "Interest already recorded",
    };
  }

  const lead = await prisma.eventLead.create({
    data: {
      eventId,
      userId,
      type,
      status: "NEW",
    },
  });

  return {
    success: true as const,
    lead,
    message: "Interest recorded successfully",
  };
}

export async function listEventExhibitors(eventId: string) {
  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId },
    include: {
      exhibitor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatar: true,
          company: true,
          jobTitle: true,
        },
      },
      space: {
        select: {
          id: true,
          name: true,
          spaceType: true,
          area: true,
          basePrice: true,
          pricePerSqm: true,
          currency: true,
          isAvailable: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const exhibitorIds = Array.from(
    new Set(
      booths
        .map((b) => b.exhibitor?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const follows = exhibitorIds.length
    ? await prisma.follow.findMany({
        where: { followingId: { in: exhibitorIds } },
        select: {
          followingId: true,
          createdAt: true,
          follower: {
            select: {
              id: true,
              avatar: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const followerMap = new Map<
    string,
    { count: number; preview: Array<{ id: string; avatar: string | null; firstName: string; lastName: string }> }
  >();

  for (const row of follows) {
    const bucket = followerMap.get(row.followingId) ?? { count: 0, preview: [] };
    bucket.count += 1;
    if (bucket.preview.length < 3) {
      bucket.preview.push({
        id: row.follower.id,
        avatar: row.follower.avatar ?? null,
        firstName: row.follower.firstName,
        lastName: row.follower.lastName,
      });
    }
    followerMap.set(row.followingId, bucket);
  }

  return booths.map((booth) => {
    const exhibitorId = booth.exhibitor?.id ?? booth.exhibitorId;
    const f = followerMap.get(exhibitorId) ?? { count: 0, preview: [] as Array<{ id: string; avatar: string | null; firstName: string; lastName: string }> };
    return {
      ...booth,
      followersCount: f.count,
      followerPreview: f.preview,
    };
  });
}

export async function listEventSpeakers(eventId: string) {
  const sessions = await prisma.speakerSession.findMany({
    where: { eventId },
    include: {
      speaker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          company: true,
          jobTitle: true,
        },
      },
    },
    orderBy: { startTime: "asc" as const },
  });

  return sessions;
}

// Speaker sessions listing used by /api/events/speakers
export async function listSpeakerSessions(params: {
  eventId?: string | null;
  speakerId?: string | null;
}) {
  const where: any = {};

  if (params.eventId) {
    where.eventId = params.eventId;
  }

  if (params.speakerId) {
    where.speakerId = params.speakerId;
  }

  const sessions = await prisma.speakerSession.findMany({
    where,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
        },
      },
      speaker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          company: true,
          jobTitle: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return sessions;
}

export async function getEventBrochureAndDocuments(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      brochure: true,
      documents: true,
    },
  });

  return event;
}

export async function updateEventLayoutPlan(eventId: string, layoutPlan: string | null) {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      layoutPlan,
    },
    select: {
      id: true,
      layoutPlan: true,
    },
  });

  return updated;
}

/** Partial update for event (description, tags, images, brochure, layoutPlan). Used by event-dashboard and Next.js proxy. */
export async function updateEventFields(
  eventId: string,
  body: {
    description?: string;
    tags?: string[];
    images?: string[];
    brochure?: string | null;
    layoutPlan?: string | null;
  }
) {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const data: Record<string, unknown> = {};
  if (typeof body.description === "string") data.description = body.description;
  if (Array.isArray(body.tags)) data.tags = body.tags;
  if (Array.isArray(body.images)) data.images = body.images;
  if (body.brochure !== undefined) data.brochure = body.brochure;
  if (body.layoutPlan !== undefined) data.layoutPlan = body.layoutPlan;

  if (Object.keys(data).length === 0) {
    return prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, description: true, tags: true, images: true, brochure: true, layoutPlan: true },
    });
  }

  return prisma.event.update({
    where: { id: eventId },
    data,
    select: {
      id: true,
      description: true,
      tags: true,
      images: true,
      brochure: true,
      layoutPlan: true,
    },
  });
}

export async function listEventSpaceCosts(eventId: string) {
  const spaces = await prisma.exhibitionSpace.findMany({
    where: {
      eventId,
      isAvailable: true,
    },
    select: {
      id: true,
      name: true,
      spaceType: true,
      description: true,
      area: true,
      basePrice: true,
      pricePerSqm: true,
      currency: true,
      additionalPowerRate: true,
      compressedAirRate: true,
      unit: true,
      pricePerUnit: true,
      isFixed: true,
      maxBooths: true,
    },
    orderBy: { basePrice: "asc" as const },
  });

  return spaces;
}

/** List exhibition spaces for an event (for Add Exhibitor dropdown and Event Info Space Cost tab). */
export async function listExhibitionSpaces(eventId: string) {
  const spaces = await prisma.exhibitionSpace.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
  });
  return spaces.map((s) => ({
    id: s.id,
    eventId: s.eventId,
    name: s.name,
    spaceType: s.spaceType,
    description: s.description,
    dimensions: s.dimensions,
    area: s.area,
    location: s.location,
    basePrice: s.basePrice,
    pricePerSqm: s.pricePerSqm,
    minArea: s.minArea,
    unit: s.unit,
    pricePerUnit: s.pricePerUnit,
    isAvailable: s.isAvailable && (s.bookedBooths ?? 0) < (s.maxBooths ?? 999),
    maxBooths: s.maxBooths,
    bookedBooths: s.bookedBooths ?? 0,
  }));
}

const EXHIBITION_SPACE_TYPES = [
  "SHELL_SPACE",
  "RAW_SPACE",
  "TWO_SIDE_OPEN",
  "THREE_SIDE_OPEN",
  "FOUR_SIDE_OPEN",
  "MEZZANINE",
  "ADDITIONAL_POWER",
  "COMPRESSED_AIR",
  "CUSTOM",
] as const;

/** Create an exhibition space for an event. */
export async function createExhibitionSpace(
  eventId: string,
  body: {
    name: string;
    spaceType?: string;
    description?: string;
    dimensions?: string;
    area?: number;
    basePrice?: number;
    minArea?: number;
    unit?: string;
    pricePerSqm?: number;
    maxBooths?: number;
  }
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) return { error: "NOT_FOUND" as const };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "NAME_REQUIRED" as const };

  const spaceType = EXHIBITION_SPACE_TYPES.includes(body.spaceType as any)
    ? (body.spaceType as (typeof EXHIBITION_SPACE_TYPES)[number])
    : "RAW_SPACE";

  const space = await prisma.exhibitionSpace.create({
    data: {
      eventId,
      name,
      spaceType,
      description: (body.description as string)?.trim() || name,
      dimensions: (body.dimensions as string)?.trim() || null,
      area: Number(body.area) || 100,
      basePrice: Number(body.basePrice) ?? 0,
      minArea: body.minArea != null ? Number(body.minArea) : null,
      unit: (body.unit as string) || "sqm",
      pricePerSqm: body.pricePerSqm != null ? Number(body.pricePerSqm) : null,
      maxBooths: body.maxBooths != null ? Number(body.maxBooths) : null,
    },
  });

  return {
    id: space.id,
    eventId: space.eventId,
    name: space.name,
    spaceType: space.spaceType,
    description: space.description,
    dimensions: space.dimensions,
    area: space.area,
    location: space.location,
    basePrice: space.basePrice,
    pricePerSqm: space.pricePerSqm,
    minArea: space.minArea,
    unit: space.unit,
    pricePerUnit: space.pricePerUnit,
    isAvailable: space.isAvailable,
    maxBooths: space.maxBooths,
    bookedBooths: space.bookedBooths ?? 0,
  };
}

/** Update an exhibition space (e.g. basePrice, pricePerSqm). */
export async function updateExhibitionSpace(
  eventId: string,
  spaceId: string,
  body: { basePrice?: number; pricePerSqm?: number; pricePerUnit?: number }
) {
  const space = await prisma.exhibitionSpace.findFirst({
    where: { id: spaceId, eventId },
  });
  if (!space) return null;

  const data: Record<string, unknown> = {};
  if (body.basePrice != null) data.basePrice = Number(body.basePrice);
  if (body.pricePerSqm != null) data.pricePerSqm = Number(body.pricePerSqm);
  if (body.pricePerUnit != null) data.pricePerUnit = Number(body.pricePerUnit);
  if (Object.keys(data).length === 0) return space;

  const updated = await prisma.exhibitionSpace.update({
    where: { id: spaceId },
    data,
  });
  return updated;
}

/** Add exhibitor to event (create ExhibitorBooth). */
export async function addExhibitorToEvent(
  eventId: string,
  body: {
    exhibitorId: string;
    spaceId: string;
    boothNumber: string;
    companyName: string;
    description?: string;
    additionalPower?: number;
    compressedAir?: number;
    setupRequirements?: string;
    specialRequests?: string;
    totalCost: number;
  }
) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return { error: "EVENT_NOT_FOUND" as const };
  const exhibitor = await prisma.user.findUnique({
    where: { id: body.exhibitorId },
    select: { id: true },
  });
  if (!exhibitor) return { error: "EXHIBITOR_NOT_FOUND" as const };
  const space = await prisma.exhibitionSpace.findFirst({
    where: { id: body.spaceId, eventId },
    select: { id: true },
  });
  if (!space) return { error: "SPACE_NOT_FOUND" as const };

  const existing = await prisma.exhibitorBooth.findUnique({
    where: { eventId_exhibitorId: { eventId, exhibitorId: body.exhibitorId } },
  });
  if (existing) return { error: "ALREADY_REGISTERED" as const };

  const booth = await prisma.exhibitorBooth.create({
    data: {
      eventId,
      exhibitorId: body.exhibitorId,
      spaceId: body.spaceId,
      boothNumber: (body.boothNumber as string)?.trim() || "TBD",
      companyName: (body.companyName as string)?.trim() || "",
      description: (body.description as string)?.trim() || null,
      additionalPower: Number(body.additionalPower) || 0,
      compressedAir: Number(body.compressedAir) || 0,
      setupRequirements: body.setupRequirements != null && body.setupRequirements !== "" ? body.setupRequirements : undefined,
      specialRequests: (body.specialRequests as string)?.trim() || null,
      totalCost: Number(body.totalCost) ?? 0,
    },
    include: {
      exhibitor: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
      space: { select: { id: true, name: true, spaceType: true, basePrice: true } },
    },
  });
  return { booth };
}

/** Remove exhibitor from event (delete ExhibitorBooth by exhibitorId). */
export async function removeExhibitorFromEvent(eventId: string, exhibitorId: string) {
  const deleted = await prisma.exhibitorBooth.deleteMany({
    where: { eventId, exhibitorId },
  });
  return deleted.count > 0;
}

// ----- Write operations: save, promotions, create, update, delete -----

export async function saveEvent(userId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "NOT_FOUND" as const };

  const existing = await prisma.savedEvent.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
  if (existing) return { alreadySaved: true as const, savedEvent: existing };

  const savedEvent = await prisma.savedEvent.create({
    data: { userId, eventId },
    include: { event: true },
  });
  return { savedEvent };
}

export async function unsaveEvent(userId: string, eventId: string) {
  await prisma.savedEvent.deleteMany({
    where: { userId, eventId },
  });
  return { removed: true };
}

export async function isEventSaved(userId: string, eventId: string): Promise<boolean> {
  const saved = await prisma.savedEvent.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
  return !!saved;
}

export async function getEventPromotions(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      startDate: true,
      status: true,
      category: true,
      organizerId: true,
    },
  });
  if (!event) return null;

  const promotions = await prisma.promotion.findMany({
    where: { eventId },
    include: {
      event: {
        select: { id: true, title: true, startDate: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    event: {
      ...event,
      date: event.startDate.toISOString().split("T")[0],
    },
    promotions,
  };
}

export async function createPromotion(
  eventId: string,
  body: { packageType: string; targetCategories: string[]; amount: number; duration: number }
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true },
  });
  if (!event) return { error: "NOT_FOUND" as const };

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + body.duration);

  const promotion = await prisma.promotion.create({
    data: {
      eventId,
      organizerId: event.organizerId,
      packageType: body.packageType,
      targetCategories: body.targetCategories ?? [],
      amount: body.amount,
      duration: body.duration,
      startDate,
      endDate,
      status: "ACTIVE",
    },
    include: {
      event: {
        select: { id: true, title: true, startDate: true, status: true },
      },
    },
  });
  return { promotion };
}

// ----- Organizer event update / delete -----

export async function updateEventByOrganizer(
  organizerId: string,
  eventId: string,
  body: Record<string, unknown>
) {
  const existingEvent = await prisma.event.findFirst({
    where: { id: eventId, organizerId },
    include: { ticketTypes: true, exhibitionSpaces: true },
  });
  if (!existingEvent) return { error: "NOT_FOUND" as const };

  const nextShortDescription =
    "shortDescription" in body
      ? trimOrganizerEventText(body.shortDescription)
      : existingEvent.shortDescription;

  const nextSubTitle =
    "subTitle" in body ? trimOrganizerEventText(body.subTitle) : existingEvent.subTitle;

  const eventUpdateData: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    shortDescription: nextShortDescription,
    subTitle: nextSubTitle,
    edition:
      body.edition != null && String(body.edition).trim() !== ""
        ? String(body.edition).trim()
        : existingEvent.edition,
    slug:
      (body.slug as string) ??
      (body.title as string)?.toString().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    status: (body.status as string)?.toUpperCase() ?? existingEvent.status,
    category: (body.category as string[]) || (body.eventType as string[]) || existingEvent.category,
    tags: (body.tags as string[]) || (body.categories as string[]) || existingEvent.tags,
    startDate: body.startDate ? new Date(body.startDate as string) : existingEvent.startDate,
    endDate: body.endDate ? new Date(body.endDate as string) : existingEvent.endDate,
    registrationStart: body.registrationStart
      ? new Date(body.registrationStart as string)
      : existingEvent.registrationStart,
    registrationEnd: body.registrationEnd
      ? new Date(body.registrationEnd as string)
      : existingEvent.registrationEnd,
    timezone: (body.timezone as string) ?? existingEvent.timezone,
    isVirtual: body.isVirtual ?? existingEvent.isVirtual,
    virtualLink: (body.virtualLink as string) || null,
    venueId: body.venue && typeof body.venue === "string" ? body.venue : existingEvent.venueId,
    maxAttendees: body.maxAttendees ?? body.capacity ?? existingEvent.maxAttendees,
    currency: (body.currency as string) ?? existingEvent.currency,
    bannerImage: (body.bannerImage as string) || (body.images as { url?: string }[])?.[0]?.url || null,
    thumbnailImage: (body.thumbnailImage as string) || null,
    isPublic: body.isPublic !== false,
    requiresApproval: !!body.requiresApproval,
    allowWaitlist: !!body.allowWaitlist,
    refundPolicy: (body.refundPolicy as string) || null,
    metaTitle: (body.metaTitle as string) || null,
    metaDescription: (body.metaDescription as string) || null,
    isFeatured: !!(body.featured ?? body.isFeatured),
    isVIP: !!(body.vip ?? body.isVIP),
  };

  const ticketTypesToCreate: Array<{ name: string; description: string; price: number; quantity: number; isActive: boolean }> = [];

  if (Array.isArray(body.ticketTypes) && body.ticketTypes.length > 0) {
    for (const t of body.ticketTypes as any[]) {
      const price = Number(t?.price ?? 0);
      const quantity = Number(t?.quantity ?? body.maxAttendees ?? body.capacity ?? 100);
      ticketTypesToCreate.push({
        name: String(t?.name ?? "General Admission"),
        description: String(t?.description ?? ""),
        price: Number.isFinite(price) ? price : 0,
        quantity: Number.isFinite(quantity) ? quantity : 100,
        isActive: t?.isActive !== false,
      });
    }
  } else if (body.generalPrice || (body.pricing as { general?: number })?.general) {
    ticketTypesToCreate.push({
      name: "General Admission",
      description: "General admission ticket",
      price: Number(body.generalPrice ?? (body.pricing as { general?: number })?.general ?? 0),
      quantity: Number(body.maxAttendees ?? body.capacity ?? 100),
      isActive: true,
    });
  }
  if (!Array.isArray(body.ticketTypes) && body.vipPrice) {
    ticketTypesToCreate.push({
      name: "VIP",
      description: "VIP ticket with premium access",
      price: Number(body.vipPrice),
      quantity: Math.floor((Number(body.maxAttendees ?? body.capacity ?? 100)) * 0.1),
      isActive: true,
    });
  }
  if (!Array.isArray(body.ticketTypes) && body.premiumPrice) {
    ticketTypesToCreate.push({
      name: "Premium",
      description: "Premium ticket with enhanced experience",
      price: Number(body.premiumPrice),
      quantity: Math.floor((Number(body.maxAttendees ?? body.capacity ?? 100)) * 0.2),
      isActive: true,
    });
  }

  if (ticketTypesToCreate.length > 0) {
    await prisma.ticketType.deleteMany({ where: { eventId } });
    (eventUpdateData as any).ticketTypes = { create: ticketTypesToCreate };
  }

  if (Array.isArray(body.exhibitionSpaces) && body.exhibitionSpaces.length > 0) {
    await prisma.exhibitionSpace.deleteMany({ where: { eventId } });
    (eventUpdateData as any).exhibitionSpaces = {
      create: (body.exhibitionSpaces as any[]).map((space: any) => ({
        spaceType: space.spaceType || "CUSTOM",
        name: space.name,
        description: space.description ?? "",
        basePrice: space.basePrice ?? 0,
        pricePerSqm: space.pricePerSqm ?? 0,
        minArea: space.minArea ?? 0,
        isFixed: space.isFixed ?? false,
        additionalPowerRate: space.additionalPowerRate ?? 0,
        compressedAirRate: space.compressedAirRate ?? 0,
        unit: space.unit ?? null,
        area: space.area ?? 0,
        isAvailable: space.isAvailable !== false,
        maxBooths: space.maxBooths ?? null,
      })),
    };
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: eventUpdateData as any,
    include: {
      exhibitionSpaces: true,
      ticketTypes: true,
      venue: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          venueCity: true,
          venueState: true,
          venueCountry: true,
        },
      },
    },
  });

  return {
    event: {
      ...updatedEvent,
      subTitle: updatedEvent.subTitle ?? null,
      edition: updatedEvent.edition || null,
    },
  };
}

export async function deleteEventByOrganizer(organizerId: string, eventId: string) {
  const existingEvent = await prisma.event.findFirst({
    where: { id: eventId, organizerId },
  });
  if (!existingEvent) return { error: "NOT_FOUND" as const };

  await prisma.ticketType.deleteMany({ where: { eventId } });
  await prisma.exhibitionSpace.deleteMany({ where: { eventId } });
  await prisma.event.delete({ where: { id: eventId } });
  await prisma.user.update({
    where: { id: organizerId },
    data: { totalEvents: { decrement: 1 } },
  });
  return { deleted: true };
}

