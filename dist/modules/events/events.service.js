"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEvents = listEvents;
exports.getFeaturedEvents = getFeaturedEvents;
exports.getEventByIdentifier = getEventByIdentifier;
exports.getCategoryStats = getCategoryStats;
exports.getEventStats = getEventStats;
exports.searchEntities = searchEntities;
exports.listRecentEvents = listRecentEvents;
exports.listVipEvents = listVipEvents;
exports.listEventLeads = listEventLeads;
exports.listEventAttendees = listEventAttendees;
exports.createEventLead = createEventLead;
exports.listEventExhibitors = listEventExhibitors;
exports.listEventSpeakers = listEventSpeakers;
exports.listSpeakerSessions = listSpeakerSessions;
exports.getEventBrochureAndDocuments = getEventBrochureAndDocuments;
exports.updateEventLayoutPlan = updateEventLayoutPlan;
exports.updateEventFields = updateEventFields;
exports.listEventSpaceCosts = listEventSpaceCosts;
exports.listExhibitionSpaces = listExhibitionSpaces;
exports.createExhibitionSpace = createExhibitionSpace;
exports.updateExhibitionSpace = updateExhibitionSpace;
exports.addExhibitorToEvent = addExhibitorToEvent;
exports.removeExhibitorFromEvent = removeExhibitorFromEvent;
exports.saveEvent = saveEvent;
exports.unsaveEvent = unsaveEvent;
exports.isEventSaved = isEventSaved;
exports.getEventPromotions = getEventPromotions;
exports.createPromotion = createPromotion;
exports.updateEventByOrganizer = updateEventByOrganizer;
exports.deleteEventByOrganizer = deleteEventByOrganizer;
const prisma_1 = __importDefault(require("../../config/prisma"));
const public_profile_1 = require("../../utils/public-profile");
const profile_slug_1 = require("../../utils/profile-slug");
const statusMap = {
    PUBLISHED: "Approved",
    PENDING_APPROVAL: "Pending Review",
    DRAFT: "Draft",
    CANCELLED: "Flagged",
    REJECTED: "Rejected",
    COMPLETED: "Approved",
};
function trimOrganizerEventText(v) {
    if (v == null)
        return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
}
async function listEvents(params) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 12;
    const skip = (page - 1) * limit;
    const andParts = [(0, public_profile_1.publicPublishedEventWhere)()];
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
    const where = { AND: andParts };
    let orderBy = {};
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
        prisma_1.default.event.findMany({
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
                    orderBy: { price: "asc" },
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
        prisma_1.default.event.count({ where }),
    ]);
    const transformedEvents = events.map((event) => {
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
                ? event.savedEvents.map((se) => ({
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
async function getFeaturedEvents() {
    const events = await prisma_1.default.event.findMany({
        where: {
            AND: [{ isFeatured: true }, (0, public_profile_1.publicPublishedEventWhere)()],
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
        orderBy: { startDate: "asc" },
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
function isEventIdUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}
function generateSlug(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}
async function getEventByIdentifier(id, viewerUserId) {
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
            orderBy: { price: "asc" },
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
            orderBy: { startTime: "asc" },
        },
        exhibitionSpaces: { where: { isAvailable: true } },
        _count: { select: { registrations: true, reviews: true } },
    };
    let event = null;
    if (isEventIdUuid(trimmed)) {
        event = await prisma_1.default.event.findUnique({
            where: { id: trimmed },
            include,
        });
    }
    if (!event) {
        event = await prisma_1.default.event.findUnique({
            where: { slug: trimmed },
            include,
        });
    }
    const slugOrTitle = trimmed.replace(/-/g, " ").trim();
    if (!event) {
        event = await prisma_1.default.event.findFirst({
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
    if (!(0, public_profile_1.canBypassEventPrivacy)(viewerUserId ?? undefined, {
        organizerId: event.organizerId,
        venueId: event.venueId,
    }) &&
        !(0, public_profile_1.isEventPubliclyVisible)({
            organizerId: event.organizerId,
            venueId: event.venueId,
            organizer: event.organizer,
            venue: event.venue,
        })) {
        return null;
    }
    const availableTickets = event.ticketTypes?.reduce((total, ticket) => total + (ticket.quantity - ticket.sold), 0) ?? 0;
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
            location: ([event.venue.venueAddress, event.venue.venueCity, event.venue.venueState, event.venue.venueCountry]
                .filter(Boolean)
                .join(", ") ||
                event.venue.location) ??
                "",
            website: event.venue.venueWebsite ?? event.venue.website ?? "",
        }
        : null;
    // Match GET /organizers/:id — User.totalEvents/activeEvents are often stale; counts must come from Event rows.
    let organizerEventCounts = null;
    if (event.organizerId && event.organizer) {
        const [allEv, publishedEv] = await Promise.all([
            prisma_1.default.event.aggregate({
                where: { organizerId: event.organizerId },
                _count: { id: true },
            }),
            prisma_1.default.event.aggregate({
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
            publicSlug: (0, profile_slug_1.getPublicProfileSlug)({
                role: "ORGANIZER",
                firstName: event.organizer.firstName,
                lastName: event.organizer.lastName,
                organizationName: event.organizer.organizationName,
                company: event.organizer.company,
            }, "ORGANIZER"),
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
    const bypassAgenda = (0, public_profile_1.canBypassEventPrivacy)(viewerUserId ?? undefined, {
        organizerId: event.organizerId,
        venueId: event.venueId,
    });
    if (!bypassAgenda && Array.isArray(data.speakerSessions)) {
        data.speakerSessions = data.speakerSessions.filter((row) => {
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
async function getCategoryStats() {
    const categoryCounts = await Promise.all(ALL_CATEGORIES.map(async (category) => {
        const count = await prisma_1.default.event.count({
            where: {
                AND: [(0, public_profile_1.publicPublishedEventWhere)(), { category: { has: category } }],
            },
        });
        return { category, count };
    }));
    const filteredCounts = categoryCounts.filter((item) => item.count > 0);
    return {
        categories: filteredCounts,
        totalCategories: filteredCounts.length,
    };
}
async function getEventStats(options) {
    const includeCategories = options.includeCategories ?? true;
    const includeCities = options.includeCities ?? false;
    const includeCountries = options.includeCountries ?? false;
    const result = {
        success: true,
    };
    if (includeCategories) {
        const { categories, totalCategories } = await getCategoryStats();
        result.categories = categories.sort((a, b) => b.count - a.count);
        result.totalCategories = totalCategories;
    }
    if (includeCities) {
        const cityRows = await prisma_1.default.city.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { name: true },
        });
        const cityCounts = await Promise.all(cityRows.map(async (cityRow) => {
            const city = cityRow.name;
            const count = await prisma_1.default.event.count({
                where: {
                    AND: [
                        (0, public_profile_1.publicPublishedEventWhere)(),
                        {
                            venue: {
                                is: {
                                    AND: [
                                        (0, public_profile_1.activePublicProfileUserWhere)(),
                                        { venueCity: { contains: city, mode: "insensitive" } },
                                    ],
                                },
                            },
                        },
                    ],
                },
            });
            return { city, count };
        }));
        const filteredCities = cityCounts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
        result.cities = filteredCities;
        result.totalCities = filteredCities.length;
    }
    if (includeCountries) {
        const countryRows = await prisma_1.default.country.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { name: true, code: true },
        });
        const countryCounts = await Promise.all(countryRows.map(async (countryRow) => {
            const country = countryRow.name;
            const count = await prisma_1.default.event.count({
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
        }));
        const filteredCountries = countryCounts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
        result.countries = filteredCountries;
        result.totalCountries = filteredCountries.length;
    }
    return result;
}
// Search service – mirrors app/api/search/route.ts
async function searchEntities(query, limit = 5) {
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
        prisma_1.default.event.findMany({
            where: {
                AND: [
                    (0, public_profile_1.publicPublishedEventWhere)(),
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
            orderBy: { startDate: "asc" },
            take: limit,
        }),
        prisma_1.default.user.findMany({
            where: {
                role: "VENUE_MANAGER",
                venueName: { contains: trimmed, mode: "insensitive" },
                ...(0, public_profile_1.activePublicProfileUserWhere)(),
            },
            select: {
                id: true,
                venueName: true,
                venueCity: true,
                venueCountry: true,
            },
            take: limit,
        }),
        prisma_1.default.user.findMany({
            where: {
                role: "SPEAKER",
                OR: [
                    { firstName: { contains: trimmed, mode: "insensitive" } },
                    { lastName: { contains: trimmed, mode: "insensitive" } },
                ],
                ...(0, public_profile_1.activePublicProfileUserWhere)(),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
            },
            take: limit,
        }),
    ]);
    const eventResults = events.map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        startDate: event.startDate,
        isVIP: event.isVIP,
        isFeatured: event.isFeatured,
        venue: event.venue,
        type: "event",
    }));
    const venueResults = venues.map((venue) => ({
        id: venue.id,
        venueName: venue.venueName,
        location: [venue.venueCity, venue.venueCountry].filter(Boolean).join(", "),
        type: "venue",
    }));
    const speakerResults = speakers.map((speaker) => ({
        id: speaker.id,
        displayName: `${speaker.firstName} ${speaker.lastName}`,
        type: "speaker",
    }));
    const allResults = [
        ...eventResults.map((e) => ({ ...e, resultType: "event" })),
        ...venueResults.map((v) => ({ ...v, resultType: "venue" })),
        ...speakerResults.map((s) => ({ ...s, resultType: "speaker" })),
    ];
    return {
        events: eventResults,
        venues: venueResults,
        speakers: speakerResults,
        allResults,
    };
}
// Simple helpers for additional event endpoints
async function listRecentEvents(limit = 10) {
    const result = await listEvents({
        page: 1,
        limit,
        sort: "newest",
    });
    return result.events;
}
async function listVipEvents(limit = 10) {
    const result = await listEvents({
        page: 1,
        limit,
        sort: "newest",
        vip: true,
    });
    return result.events;
}
// ----- Event sub-resources (leads, exhibitors, speakers, brochure, layout, space-costs) -----
async function listEventLeads(eventId) {
    const leads = await prisma_1.default.eventLead.findMany({
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
async function listEventAttendees(eventId) {
    const leads = await prisma_1.default.eventLead.findMany({
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
async function createEventLead(args) {
    const { eventId, userId, type } = args;
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!event) {
        return { error: "EVENT_NOT_FOUND" };
    }
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });
    if (!user) {
        return { error: "USER_NOT_FOUND" };
    }
    const existing = await prisma_1.default.eventLead.findFirst({
        where: {
            eventId,
            userId,
            type,
        },
    });
    if (existing) {
        return {
            success: true,
            alreadyExists: true,
            lead: existing,
            message: "Interest already recorded",
        };
    }
    const lead = await prisma_1.default.eventLead.create({
        data: {
            eventId,
            userId,
            type,
            status: "NEW",
        },
    });
    return {
        success: true,
        lead,
        message: "Interest recorded successfully",
    };
}
async function listEventExhibitors(eventId) {
    const booths = await prisma_1.default.exhibitorBooth.findMany({
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
    const exhibitorIds = Array.from(new Set(booths
        .map((b) => b.exhibitor?.id)
        .filter((id) => Boolean(id))));
    const follows = exhibitorIds.length
        ? await prisma_1.default.follow.findMany({
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
    const followerMap = new Map();
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
        const f = followerMap.get(exhibitorId) ?? { count: 0, preview: [] };
        return {
            ...booth,
            followersCount: f.count,
            followerPreview: f.preview,
        };
    });
}
async function listEventSpeakers(eventId) {
    const sessions = await prisma_1.default.speakerSession.findMany({
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
        orderBy: { startTime: "asc" },
    });
    return sessions;
}
// Speaker sessions listing used by /api/events/speakers
async function listSpeakerSessions(params) {
    const where = {};
    if (params.eventId) {
        where.eventId = params.eventId;
    }
    if (params.speakerId) {
        where.speakerId = params.speakerId;
    }
    const sessions = await prisma_1.default.speakerSession.findMany({
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
async function getEventBrochureAndDocuments(eventId) {
    const event = await prisma_1.default.event.findUnique({
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
async function updateEventLayoutPlan(eventId, layoutPlan) {
    const existing = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!existing) {
        return null;
    }
    const updated = await prisma_1.default.event.update({
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
async function updateEventFields(eventId, body) {
    const existing = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!existing) {
        return null;
    }
    const data = {};
    if (typeof body.description === "string")
        data.description = body.description;
    if (Array.isArray(body.tags))
        data.tags = body.tags;
    if (Array.isArray(body.images))
        data.images = body.images;
    if (body.brochure !== undefined)
        data.brochure = body.brochure;
    if (body.layoutPlan !== undefined)
        data.layoutPlan = body.layoutPlan;
    if (Object.keys(data).length === 0) {
        return prisma_1.default.event.findUnique({
            where: { id: eventId },
            select: { id: true, description: true, tags: true, images: true, brochure: true, layoutPlan: true },
        });
    }
    return prisma_1.default.event.update({
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
async function listEventSpaceCosts(eventId) {
    const spaces = await prisma_1.default.exhibitionSpace.findMany({
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
        orderBy: { basePrice: "asc" },
    });
    return spaces;
}
/** List exhibition spaces for an event (for Add Exhibitor dropdown and Event Info Space Cost tab). */
async function listExhibitionSpaces(eventId) {
    const spaces = await prisma_1.default.exhibitionSpace.findMany({
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
];
/** Create an exhibition space for an event. */
async function createExhibitionSpace(eventId, body) {
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!event)
        return { error: "NOT_FOUND" };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name)
        return { error: "NAME_REQUIRED" };
    const spaceType = EXHIBITION_SPACE_TYPES.includes(body.spaceType)
        ? body.spaceType
        : "RAW_SPACE";
    const space = await prisma_1.default.exhibitionSpace.create({
        data: {
            eventId,
            name,
            spaceType,
            description: body.description?.trim() || name,
            dimensions: body.dimensions?.trim() || null,
            area: Number(body.area) || 100,
            basePrice: Number(body.basePrice) ?? 0,
            minArea: body.minArea != null ? Number(body.minArea) : null,
            unit: body.unit || "sqm",
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
async function updateExhibitionSpace(eventId, spaceId, body) {
    const space = await prisma_1.default.exhibitionSpace.findFirst({
        where: { id: spaceId, eventId },
    });
    if (!space)
        return null;
    const data = {};
    if (body.basePrice != null)
        data.basePrice = Number(body.basePrice);
    if (body.pricePerSqm != null)
        data.pricePerSqm = Number(body.pricePerSqm);
    if (body.pricePerUnit != null)
        data.pricePerUnit = Number(body.pricePerUnit);
    if (Object.keys(data).length === 0)
        return space;
    const updated = await prisma_1.default.exhibitionSpace.update({
        where: { id: spaceId },
        data,
    });
    return updated;
}
/** Add exhibitor to event (create ExhibitorBooth). */
async function addExhibitorToEvent(eventId, body) {
    const event = await prisma_1.default.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event)
        return { error: "EVENT_NOT_FOUND" };
    const exhibitor = await prisma_1.default.user.findUnique({
        where: { id: body.exhibitorId },
        select: { id: true },
    });
    if (!exhibitor)
        return { error: "EXHIBITOR_NOT_FOUND" };
    const space = await prisma_1.default.exhibitionSpace.findFirst({
        where: { id: body.spaceId, eventId },
        select: { id: true },
    });
    if (!space)
        return { error: "SPACE_NOT_FOUND" };
    const existing = await prisma_1.default.exhibitorBooth.findUnique({
        where: { eventId_exhibitorId: { eventId, exhibitorId: body.exhibitorId } },
    });
    if (existing)
        return { error: "ALREADY_REGISTERED" };
    const booth = await prisma_1.default.exhibitorBooth.create({
        data: {
            eventId,
            exhibitorId: body.exhibitorId,
            spaceId: body.spaceId,
            boothNumber: body.boothNumber?.trim() || "TBD",
            companyName: body.companyName?.trim() || "",
            description: body.description?.trim() || null,
            additionalPower: Number(body.additionalPower) || 0,
            compressedAir: Number(body.compressedAir) || 0,
            setupRequirements: body.setupRequirements != null && body.setupRequirements !== "" ? body.setupRequirements : undefined,
            specialRequests: body.specialRequests?.trim() || null,
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
async function removeExhibitorFromEvent(eventId, exhibitorId) {
    const deleted = await prisma_1.default.exhibitorBooth.deleteMany({
        where: { eventId, exhibitorId },
    });
    return deleted.count > 0;
}
// ----- Write operations: save, promotions, create, update, delete -----
async function saveEvent(userId, eventId) {
    const event = await prisma_1.default.event.findUnique({ where: { id: eventId } });
    if (!event)
        return { error: "NOT_FOUND" };
    const existing = await prisma_1.default.savedEvent.findUnique({
        where: { userId_eventId: { userId, eventId } },
    });
    if (existing)
        return { alreadySaved: true, savedEvent: existing };
    const savedEvent = await prisma_1.default.savedEvent.create({
        data: { userId, eventId },
        include: { event: true },
    });
    return { savedEvent };
}
async function unsaveEvent(userId, eventId) {
    await prisma_1.default.savedEvent.deleteMany({
        where: { userId, eventId },
    });
    return { removed: true };
}
async function isEventSaved(userId, eventId) {
    const saved = await prisma_1.default.savedEvent.findUnique({
        where: { userId_eventId: { userId, eventId } },
    });
    return !!saved;
}
async function getEventPromotions(eventId) {
    const event = await prisma_1.default.event.findUnique({
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
    if (!event)
        return null;
    const promotions = await prisma_1.default.promotion.findMany({
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
async function createPromotion(eventId, body) {
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true, organizerId: true },
    });
    if (!event)
        return { error: "NOT_FOUND" };
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + body.duration);
    const promotion = await prisma_1.default.promotion.create({
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
async function updateEventByOrganizer(organizerId, eventId, body) {
    const existingEvent = await prisma_1.default.event.findFirst({
        where: { id: eventId, organizerId },
        include: { ticketTypes: true, exhibitionSpaces: true },
    });
    if (!existingEvent)
        return { error: "NOT_FOUND" };
    const nextShortDescription = "shortDescription" in body
        ? trimOrganizerEventText(body.shortDescription)
        : existingEvent.shortDescription;
    const nextSubTitle = "subTitle" in body ? trimOrganizerEventText(body.subTitle) : existingEvent.subTitle;
    const eventUpdateData = {
        title: body.title,
        description: body.description,
        shortDescription: nextShortDescription,
        subTitle: nextSubTitle,
        edition: body.edition != null && String(body.edition).trim() !== ""
            ? String(body.edition).trim()
            : existingEvent.edition,
        slug: body.slug ??
            body.title?.toString().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        status: body.status?.toUpperCase() ?? existingEvent.status,
        category: body.category || body.eventType || existingEvent.category,
        tags: body.tags || body.categories || existingEvent.tags,
        startDate: body.startDate ? new Date(body.startDate) : existingEvent.startDate,
        endDate: body.endDate ? new Date(body.endDate) : existingEvent.endDate,
        registrationStart: body.registrationStart
            ? new Date(body.registrationStart)
            : existingEvent.registrationStart,
        registrationEnd: body.registrationEnd
            ? new Date(body.registrationEnd)
            : existingEvent.registrationEnd,
        timezone: body.timezone ?? existingEvent.timezone,
        isVirtual: body.isVirtual ?? existingEvent.isVirtual,
        virtualLink: body.virtualLink || null,
        venueId: body.venue && typeof body.venue === "string" ? body.venue : existingEvent.venueId,
        maxAttendees: body.maxAttendees ?? body.capacity ?? existingEvent.maxAttendees,
        currency: body.currency ?? existingEvent.currency,
        bannerImage: body.bannerImage || body.images?.[0]?.url || null,
        thumbnailImage: body.thumbnailImage || null,
        isPublic: body.isPublic !== false,
        requiresApproval: !!body.requiresApproval,
        allowWaitlist: !!body.allowWaitlist,
        refundPolicy: body.refundPolicy || null,
        metaTitle: body.metaTitle || null,
        metaDescription: body.metaDescription || null,
        isFeatured: !!(body.featured ?? body.isFeatured),
        isVIP: !!(body.vip ?? body.isVIP),
    };
    const ticketTypesToCreate = [];
    if (Array.isArray(body.ticketTypes) && body.ticketTypes.length > 0) {
        for (const t of body.ticketTypes) {
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
    }
    else if (body.generalPrice || body.pricing?.general) {
        ticketTypesToCreate.push({
            name: "General Admission",
            description: "General admission ticket",
            price: Number(body.generalPrice ?? body.pricing?.general ?? 0),
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
        await prisma_1.default.ticketType.deleteMany({ where: { eventId } });
        eventUpdateData.ticketTypes = { create: ticketTypesToCreate };
    }
    if (Array.isArray(body.exhibitionSpaces) && body.exhibitionSpaces.length > 0) {
        await prisma_1.default.exhibitionSpace.deleteMany({ where: { eventId } });
        eventUpdateData.exhibitionSpaces = {
            create: body.exhibitionSpaces.map((space) => ({
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
    const updatedEvent = await prisma_1.default.event.update({
        where: { id: eventId },
        data: eventUpdateData,
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
async function deleteEventByOrganizer(organizerId, eventId) {
    const existingEvent = await prisma_1.default.event.findFirst({
        where: { id: eventId, organizerId },
    });
    if (!existingEvent)
        return { error: "NOT_FOUND" };
    await prisma_1.default.ticketType.deleteMany({ where: { eventId } });
    await prisma_1.default.exhibitionSpace.deleteMany({ where: { eventId } });
    await prisma_1.default.event.delete({ where: { id: eventId } });
    await prisma_1.default.user.update({
        where: { id: organizerId },
        data: { totalEvents: { decrement: 1 } },
    });
    return { deleted: true };
}
