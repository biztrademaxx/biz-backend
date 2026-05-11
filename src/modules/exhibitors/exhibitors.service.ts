import prisma from "../../config/prisma";
import type { Prisma } from "@prisma/client";
import {
  activePublicProfileUserWhere,
  canUserViewOwnPrivateProfile,
  publicPublishedEventWhere,
} from "../../utils/public-profile";
import { getDisplayName } from "../../utils/display-name";
import { getPublicProfileSlug, isUuidLike, publicSlugRequestMatches } from "../../utils/profile-slug";

// List exhibitors (read-only)
export async function listExhibitors() {
  const exhibitors = await prisma.user.findMany({
    where: {
      role: "EXHIBITOR",
      ...activePublicProfileUserWhere(),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatar: true,
      bio: true,
      company: true,
      jobTitle: true,
      location: true,
      website: true,
      linkedin: true,
      twitter: true,
      businessEmail: true,
      businessPhone: true,
      businessAddress: true,
      taxId: true,
    },
  });

  return exhibitors.map((e) => ({
    ...e,
    publicSlug: getPublicProfileSlug(
      {
        role: "EXHIBITOR",
        firstName: e.firstName,
        lastName: e.lastName,
        company: e.company,
      },
      "EXHIBITOR",
    ),
  }));
}

/** Create a new exhibitor (User with role EXHIBITOR). */
export async function createExhibitor(body: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  bio?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  taxId?: string;
}) {
  const { firstName, lastName, email, company } = body;
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !company?.trim()) {
    return { error: "MISSING_FIELDS" as const, missing: ["firstName", "lastName", "email", "company"] };
  }
  const existing = await prisma.user.findUnique({
    where: { email: email.trim() },
    select: { id: true },
  });
  if (existing) {
    return { error: "EMAIL_EXISTS" as const };
  }
  const exhibitor = await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: body.phone?.trim() || null,
      bio: body.bio?.trim() || null,
      company: company.trim(),
      jobTitle: body.jobTitle?.trim() || null,
      location: body.location?.trim() || null,
      website: body.website?.trim() || null,
      linkedin: body.linkedin?.trim() || null,
      twitter: body.twitter?.trim() || null,
      businessEmail: body.businessEmail?.trim() || null,
      businessPhone: body.businessPhone?.trim() || null,
      businessAddress: body.businessAddress?.trim() || null,
      taxId: body.taxId?.trim() || null,
      role: "EXHIBITOR",
      isActive: true,
      isVerified: false,
      password: "TEMP_PASSWORD",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatar: true,
      bio: true,
      company: true,
      jobTitle: true,
      location: true,
      website: true,
      linkedin: true,
      twitter: true,
      businessEmail: true,
      businessPhone: true,
      businessAddress: true,
      taxId: true,
    },
  });
  return { exhibitor };
}

/** Update exhibitor profile (User with role EXHIBITOR). Persists to PostgreSQL. */
export async function updateExhibitorProfile(
  id: string,
  body: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    bio?: string;
    website?: string;
    twitter?: string;
    jobTitle?: string;
    company?: string;
    linkedin?: string;
    location?: string;
    businessEmail?: string;
    businessPhone?: string;
    businessAddress?: string;
  }
) {
  if (!id || id === "undefined") {
    throw new Error("Invalid exhibitor ID");
  }

  const existing = await prisma.user.findFirst({
    where: { id, role: "EXHIBITOR" },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Exhibitor not found");
  }

  const data: Record<string, unknown> = {};
  const fn = String(body.firstName ?? "").trim();
  const ln = String(body.lastName ?? "").trim();
  if (body.firstName !== undefined && fn) data.firstName = fn;
  if (body.lastName !== undefined && ln) data.lastName = ln;
  if (body.phone !== undefined) data.phone = body.phone === "" ? null : (body.phone as string);
  if (body.avatar !== undefined) data.avatar = body.avatar === "" ? null : (body.avatar as string);
  if (body.bio !== undefined) data.bio = body.bio === "" ? null : (body.bio as string);
  if (body.website !== undefined) data.website = body.website === "" ? null : (body.website as string);
  if (body.twitter !== undefined) data.twitter = body.twitter === "" ? null : (body.twitter as string);
  if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle === "" ? null : (body.jobTitle as string);
  if (body.company !== undefined) data.company = body.company === "" ? null : (body.company as string);
  if (body.linkedin !== undefined) data.linkedin = body.linkedin === "" ? null : (body.linkedin as string);
  if (body.location !== undefined) data.location = body.location === "" ? null : (body.location as string);
  if (body.businessEmail !== undefined) data.businessEmail = body.businessEmail === "" ? null : (body.businessEmail as string);
  if (body.businessPhone !== undefined) data.businessPhone = body.businessPhone === "" ? null : (body.businessPhone as string);
  if (body.businessAddress !== undefined) data.businessAddress = body.businessAddress === "" ? null : (body.businessAddress as string);

  if (Object.keys(data).length === 0) {
    return getExhibitorById(id, id);
  }

  await prisma.user.update({
    where: { id },
    data: data as any,
  });

  return getExhibitorById(id, id);
}

// Single exhibitor (read-only) – shape for public exhibitor page
async function resolveExhibitorId(identifier: string): Promise<string | null> {
  if (isUuidLike(identifier)) return identifier;
  const targetSlug = String(identifier || "").trim().toLowerCase();
  if (!targetSlug) return null;
  const exhibitors = await prisma.user.findMany({
    where: { role: "EXHIBITOR", isActive: true },
    select: { id: true, firstName: true, lastName: true, organizationName: true, company: true },
  });
  const withSlug = exhibitors.map((u) => ({
    u,
    slug: getPublicProfileSlug(
      {
        role: "EXHIBITOR",
        firstName: u.firstName,
        lastName: u.lastName,
        organizationName: u.organizationName,
        company: u.company,
      },
      "EXHIBITOR",
    ),
  }));
  const exact = withSlug.filter((x) => x.slug === targetSlug);
  if (exact.length === 1) return exact[0].u.id;
  const loose = withSlug.filter((x) => publicSlugRequestMatches(x.slug, targetSlug));
  if (loose.length === 1) return loose[0].u.id;
  if (loose.length > 1) {
    const narrowed = loose.filter((x) => x.slug === targetSlug);
    if (narrowed.length === 1) return narrowed[0].u.id;
    return null;
  }
  return null;
}

export async function getExhibitorById(identifier: string, viewerUserId?: string | null) {
  const id = await resolveExhibitorId(identifier);
  if (!id || id === "undefined") {
    throw new Error("Invalid exhibitor ID");
  }

  const isSelf = canUserViewOwnPrivateProfile(viewerUserId ?? undefined, id);
  const user = await prisma.user.findFirst({
    where: {
      id,
      role: "EXHIBITOR",
      ...(isSelf ? {} : activePublicProfileUserWhere()),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      role: true,
      bio: true,
      website: true,
      twitter: true,
      jobTitle: true,
      company: true,
      linkedin: true,
      location: true,
      isVerified: true,
      createdAt: true,
      companyIndustry: true,
      description: true,
      organizationName: true,
      headquarters: true,
      founded: true,
      teamSize: true,
      specialties: true,
      certifications: true,
      businessEmail: true,
      businessPhone: true,
      businessAddress: true,
      totalEvents: true,
      activeEvents: true,
    },
  });

  if (!user) {
    return null;
  }

  // Compute total and active events from ExhibitorBooth (User.totalEvents/activeEvents may be stale)
  const now = new Date();
  const [totalEventsCount, activeEventsCount] = await Promise.all([
    prisma.exhibitorBooth.count({ where: { exhibitorId: id } }),
    prisma.exhibitorBooth.count({
      where: {
        exhibitorId: id,
        event: {
          endDate: { gte: now },
        },
      },
    }),
  ]);

  const displayName = getDisplayName({
    role: "EXHIBITOR",
    firstName: user.firstName,
    lastName: user.lastName,
    organizationName: user.organizationName,
    company: user.company,
  });

  return {
    id: user.id,
    email: user.email ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
    displayName,
    publicSlug: getPublicProfileSlug(
      {
        role: "EXHIBITOR",
        firstName: user.firstName,
        lastName: user.lastName,
        organizationName: user.organizationName,
        company: user.company,
      },
      "EXHIBITOR",
    ),
    phone: user.phone ?? undefined,
    avatar: user.avatar ?? undefined,
    bio: user.bio ?? user.description ?? undefined,
    website: user.website ?? undefined,
    twitter: user.twitter ?? undefined,
    jobTitle: user.jobTitle ?? undefined,
    companyName: user.company ?? user.organizationName ?? undefined,
    companyLogo: user.avatar ?? undefined,
    company: user.company ?? user.organizationName ?? undefined,
    linkedin: user.linkedin ?? undefined,
    location: user.location ?? undefined,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
    industry: user.companyIndustry ?? undefined,
    companySize: user.teamSize ?? undefined,
    foundedYear: user.founded ?? undefined,
    headquarters: user.headquarters ?? undefined,
    specialties: user.specialties ?? undefined,
    certifications: user.certifications ?? undefined,
    businessEmail: user.businessEmail ?? undefined,
    businessPhone: user.businessPhone ?? undefined,
    businessAddress: user.businessAddress ?? undefined,
    totalEvents: totalEventsCount,
    activeEvents: activeEventsCount,
  };
}

// Exhibitor analytics – currently mock data (preserve shape)
export async function getExhibitorAnalytics(_id: string) {
  const analytics = {
    overview: {
      totalProfileViews: 1850,
      brochureDownloads: 456,
      leadsGenerated: 89,
      visitorEngagement: 67.5,
    },
    profileViewsData: [
      { date: "Jan 10", views: 45 },
      { date: "Jan 11", views: 52 },
      { date: "Jan 12", views: 38 },
      { date: "Jan 13", views: 61 },
      { date: "Jan 14", views: 48 },
      { date: "Jan 15", views: 73 },
      { date: "Jan 16", views: 56 },
      { date: "Jan 17", views: 69 },
      { date: "Jan 18", views: 82 },
      { date: "Jan 19", views: 74 },
    ],
    brochureDownloadsData: [
      { name: "AI Platform Brochure", downloads: 156, percentage: 34.2 },
      { name: "Security Suite Overview", downloads: 123, percentage: 27.0 },
      { name: "Mobile App Features", downloads: 89, percentage: 19.5 },
      { name: "Technical Specifications", downloads: 67, percentage: 14.7 },
      { name: "Pricing Guide", downloads: 21, percentage: 4.6 },
    ],
    leadSourceData: [
      { name: "Profile Views", value: 45, color: "#3B82F6" },
      { name: "Brochure Downloads", value: 28, color: "#10B981" },
      { name: "Product Inquiries", value: 16, color: "#F59E0B" },
      { name: "Appointment Requests", value: 11, color: "#EF4444" },
    ],
    engagementData: [
      { metric: "Profile Views", current: 1850, previous: 1420, change: 30.3 },
      { metric: "Brochure Downloads", current: 456, previous: 389, change: 17.2 },
      { metric: "Product Inquiries", current: 89, previous: 76, change: 17.1 },
      { metric: "Appointment Bookings", current: 23, previous: 18, change: 27.8 },
    ],
    eventPerformance: [
      {
        eventId: "event-1",
        eventName: "Tech Conference 2024",
        boothVisits: 156,
        leadsGenerated: 12,
        conversions: 3,
        revenue: 2999.99,
        roi: 185,
      },
      {
        eventId: "event-2",
        eventName: "Innovation Summit",
        boothVisits: 89,
        leadsGenerated: 8,
        conversions: 1,
        revenue: 1499.99,
        roi: 120,
      },
    ],
    productPerformance: [
      {
        productId: "prod-1",
        productName: "Smart Display System",
        views: 156,
        inquiries: 23,
        conversions: 2,
        revenue: 5999.98,
        conversionRate: 8.7,
      },
      {
        productId: "prod-2",
        productName: "Interactive Software Platform",
        views: 89,
        inquiries: 12,
        conversions: 1,
        revenue: 1499.99,
        conversionRate: 13.5,
      },
      {
        productId: "prod-3",
        productName: "Portable Exhibition Booth",
        views: 67,
        inquiries: 8,
        conversions: 0,
        revenue: 0,
        conversionRate: 0,
      },
    ],
    leadAnalytics: {
      totalLeads: 89,
      newLeads: 12,
      contactedLeads: 34,
      qualifiedLeads: 28,
      convertedLeads: 15,
      averageScore: 75.5,
      conversionRate: 16.9,
      sourceBreakdown: {
        "Event Booth": 35,
        Website: 28,
        Referral: 16,
        "Social Media": 10,
      },
    },
    appointmentAnalytics: {
      totalAppointments: 23,
      confirmedAppointments: 18,
      pendingAppointments: 3,
      completedAppointments: 15,
      cancelledAppointments: 2,
      averageDuration: 45,
      showUpRate: 83.3,
      typeBreakdown: {
        PRODUCT_DEMO: 12,
        CONSULTATION: 7,
        FOLLOW_UP: 4,
      },
    },
  };

  return analytics;
}

// Exhibitor events (read-only)
export async function getExhibitorEvents(exhibitorId: string, viewerUserId?: string | null) {
  exhibitorId = (await resolveExhibitorId(exhibitorId)) ?? "";
  if (!exhibitorId) {
    return [];
  }

  const isSelf = canUserViewOwnPrivateProfile(viewerUserId ?? undefined, exhibitorId);
  const exists = await prisma.user.findFirst({
    where: { id: exhibitorId, role: "EXHIBITOR" },
    select: { id: true },
  });
  if (!exists) {
    throw new Error("exhibitorId is required");
  }

  if (!isSelf) {
    const visible = await prisma.user.findFirst({
      where: { id: exhibitorId, role: "EXHIBITOR", ...activePublicProfileUserWhere() },
      select: { id: true },
    });
    if (!visible) {
      return [];
    }
  }

  const boothWhere: Prisma.ExhibitorBoothWhereInput = { exhibitorId };
  if (!isSelf) {
    boothWhere.event = { is: publicPublishedEventWhere() };
  }

  const booths = await prisma.exhibitorBooth.findMany({
    where: boothWhere,
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          startDate: true,
          endDate: true,
          status: true,
          currency: true,
          images: true,
          bannerImage: true,
          thumbnailImage: true,
          venue: {
            select: {
              venueName: true,
              venueAddress: true,
              venueCity: true,
              venueState: true,
              venueCountry: true,
              venueZipCode: true,
            },
          },
          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              company: true,
            },
          },
        },
      },
      exhibitor: {
        select: {
          firstName: true,
          lastName: true,
          company: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const events = booths.map((booth) => {
    const venue = booth.event.venue as {
      venueName?: string
      venueAddress?: string
      venueCity?: string
      venueState?: string
      venueCountry?: string
      venueZipCode?: string
    } | null
    const rawStart = booth.event.startDate as Date
    const rawEnd = booth.event.endDate as Date
    const startIso = rawStart instanceof Date ? rawStart.toISOString() : String(rawStart)
    const endIso = rawEnd instanceof Date ? rawEnd.toISOString() : String(rawEnd)
    return {
      id: booth.id,
      eventId: booth.eventId,
      eventSlug: booth.event.slug || booth.event.id,
      eventName: booth.event.title,
      bannerImage: booth.event.bannerImage || booth.event.images?.[0] || null,
      thumbnailImage: booth.event.thumbnailImage || booth.event.images?.[0] || null,
      date: startIso.split("T")[0],
      endDate: endIso.split("T")[0],
      rawStartDate: startIso,
      rawEndDate: endIso,
      venue: venue
        ? {
            venueName: venue.venueName ?? "",
            venueAddress: venue.venueAddress ?? "",
            venueCity: venue.venueCity ?? "",
            venueState: venue.venueState ?? "",
            venueCountry: venue.venueCountry ?? "",
            venueZipCode: venue.venueZipCode ?? "",
          }
        : null,
      boothSize: "Standard",
      boothNumber: booth.boothNumber,
      paymentStatus: booth.status === "BOOKED" ? "PAID" : "PENDING",
      setupTime: "8:00 AM - 10:00 AM",
      dismantleTime: "6:00 PM - 8:00 PM",
      passes: 5,
      passesUsed: 0,
      invoiceAmount: booth.totalCost,
      currency: booth.currency || booth.event.currency || "USD",
      status: booth.event.status,
      specialRequests: booth.specialRequests ?? undefined,
      organizer: booth.event.organizer,
    }
  })

  return events;
}

/** Logged-in exhibitor only: promotions + event dropdown (same shape as Next `/api/exhibitors/promotions`). */
export async function getExhibitorPromotionsMarketingForSelf(
  exhibitorId: string,
  viewerUserId: string,
): Promise<{
  promotions: Array<{
    id: string;
    eventId: string | null;
    eventName: string;
    packageType: string;
    status: string;
    impressions: number;
    clicks: number;
    conversions: number;
    startDate: Date;
    endDate: Date;
    amount: number;
    duration: number;
    targetCategories: string[];
  }>;
  events: Array<{ id: string; title: string; date: string; location: string; status: string }>;
}> {
  const resolved = (await resolveExhibitorId(exhibitorId)) ?? exhibitorId;
  if (!resolved || viewerUserId !== resolved) {
    throw new Error("FORBIDDEN");
  }

  const eventsFull = await getExhibitorEvents(resolved, viewerUserId);
  const eventsMap = new Map<
    string,
    { id: string; title: string; date: string; location: string; status: string }
  >();
  for (const row of eventsFull) {
    const eid = row.eventId;
    if (!eid || eventsMap.has(eid)) continue;
    const v = row.venue as {
      venueName?: string;
      venueCity?: string;
      venueState?: string;
    } | null;
    const parts = v ? [v.venueName, v.venueCity, v.venueState].filter(Boolean) : [];
    const location = parts.length ? parts.join(", ") : "N/A";
    eventsMap.set(eid, {
      id: eid,
      title: row.eventName,
      date: row.date,
      location,
      status: String(row.status ?? "Scheduled"),
    });
  }

  const promotions = await prisma.promotion.findMany({
    where: { exhibitorId: resolved },
    include: {
      event: { select: { title: true, startDate: true, endDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedPromotions = promotions.map((promotion) => ({
    id: promotion.id,
    eventId: promotion.eventId,
    eventName: promotion.event?.title || "Unknown Event",
    packageType: promotion.packageType,
    status: promotion.status,
    impressions: promotion.impressions ?? 0,
    clicks: promotion.clicks ?? 0,
    conversions: promotion.conversions ?? 0,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    amount: promotion.amount,
    duration: promotion.duration,
    targetCategories: promotion.targetCategories ?? [],
  }));

  return {
    promotions: formattedPromotions,
    events: Array.from(eventsMap.values()),
  };
}

export type CreateExhibitorPromotionBody = {
  exhibitorId: string;
  eventId: string;
  packageType: string;
  targetCategories: string[];
  amount: number;
  duration: number;
};

/** Logged-in exhibitor only: create promotion if they have a booth for the event. */
export async function createExhibitorPromotionForSelf(
  viewerUserId: string,
  body: CreateExhibitorPromotionBody,
): Promise<
  | { promotion: Awaited<ReturnType<typeof prisma.promotion.create>> }
  | { error: "FORBIDDEN" | "NOT_FOUND" | "NOT_BOOTH" | "INVALID" }
> {
  const resolved = (await resolveExhibitorId(body.exhibitorId)) ?? body.exhibitorId;
  if (!resolved || viewerUserId !== resolved) {
    return { error: "FORBIDDEN" };
  }

  const eventId = body.eventId?.trim();
  const packageType = body.packageType?.trim();
  const targetCategories = Array.isArray(body.targetCategories) ? body.targetCategories : [];
  if (!eventId || !packageType || targetCategories.length === 0) {
    return { error: "INVALID" };
  }

  const amount = Number(body.amount);
  const duration = Number(body.duration);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(duration) || duration <= 0) {
    return { error: "INVALID" };
  }

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { exhibitorId: resolved, eventId },
    select: { id: true },
  });
  if (!booth) {
    return { error: "NOT_BOOTH" };
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    return { error: "NOT_FOUND" };
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + Math.floor(duration));

  const promotion = await prisma.promotion.create({
    data: {
      exhibitorId: resolved,
      eventId,
      organizerId: null,
      packageType,
      targetCategories,
      amount,
      duration: Math.floor(duration),
      startDate,
      endDate,
      status: "PENDING",
      impressions: 0,
      clicks: 0,
      conversions: 0,
    },
  });

  return { promotion };
}

// --- Exhibitor reviews ---
export async function listExhibitorReviews(exhibitorId: string) {
  exhibitorId = (await resolveExhibitorId(exhibitorId)) ?? "";
  if (!exhibitorId) {
    return [];
  }
  const rows = await prisma.review.findMany({
    where: { exhibitorId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
      replies: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const toUserDisplay = (u: { id: string; firstName: string | null; lastName: string | null; email: string | null; avatar: string | null } | null) => {
    if (!u) return { id: "", firstName: "Anonymous", lastName: "", avatar: undefined as string | undefined };
    const first = (u.firstName ?? "").trim();
    const last = (u.lastName ?? "").trim();
    if (first || last) {
      return { id: u.id, firstName: first, lastName: last, avatar: u.avatar ?? undefined };
    }
    const email = (u.email ?? "").trim();
    const fromEmail = email ? email.split("@")[0] : "";
    const displayName = fromEmail || "Visitor";
    return { id: u.id, firstName: displayName, lastName: "", avatar: u.avatar ?? undefined };
  };

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating ?? 0,
    title: "",
    comment: r.comment ?? "",
    createdAt: r.createdAt.toISOString(),
    user: toUserDisplay(r.user),
    replies: (r.replies ?? []).map((rep) => ({
      id: rep.id,
      content: rep.content,
      createdAt: rep.createdAt.toISOString(),
      isOrganizerReply: rep.isOrganizerReply,
      user: toUserDisplay(rep.user),
    })),
  }));
}

/** Leads count = distinct users who followed this exhibitor OR have a connection (Connect) with them (PENDING or ACCEPTED). */
export async function getExhibitorLeadsCount(exhibitorId: string): Promise<number> {
  if (!exhibitorId) return 0;

  const [followerRows, connectionRows] = await Promise.all([
    (prisma as any).follow.findMany({
      where: { followingId: exhibitorId },
      select: { followerId: true },
    }),
    (prisma as any).connection.findMany({
      where: {
        OR: [
          { requesterId: exhibitorId, status: { in: ["PENDING", "ACCEPTED"] } },
          { receiverId: exhibitorId, status: { in: ["PENDING", "ACCEPTED"] } },
        ],
      },
      select: { requesterId: true, receiverId: true },
    }),
  ]);

  const leadIds = new Set<string>();
  (followerRows as { followerId: string }[]).forEach((r) => leadIds.add(r.followerId));
  (connectionRows as { requesterId: string; receiverId: string }[]).forEach((r) => {
    leadIds.add(r.requesterId);
    leadIds.add(r.receiverId);
  });
  leadIds.delete(exhibitorId);
  return leadIds.size;
}

export async function addExhibitorReviewReply(
  exhibitorId: string,
  reviewId: string,
  body: { content: string },
  userId: string
) {
  exhibitorId = (await resolveExhibitorId(exhibitorId)) ?? "";
  if (!exhibitorId) {
    throw new Error("Exhibitor not found");
  }
  const review = await prisma.review.findFirst({
    where: { id: reviewId, exhibitorId },
  });
  if (!review) {
    throw new Error("Review not found");
  }
  const reply = await prisma.reviewReply.create({
    data: {
      reviewId,
      userId,
      content: body.content?.trim() ?? "",
      isOrganizerReply: true,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  });
  return {
    id: reply.id,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
    isOrganizerReply: reply.isOrganizerReply,
    user: reply.user
      ? {
          id: reply.user.id,
          firstName: reply.user.firstName,
          lastName: reply.user.lastName,
          avatar: reply.user.avatar ?? undefined,
        }
      : { id: "", firstName: "Unknown", lastName: "", avatar: undefined },
  };
}

export async function createExhibitorReview(
  exhibitorId: string,
  body: { rating: number; title?: string; comment: string },
  userId?: string
) {
  exhibitorId = (await resolveExhibitorId(exhibitorId)) ?? "";
  if (!exhibitorId) {
    throw new Error("Exhibitor not found");
  }
  const review = await prisma.review.create({
    data: {
      exhibitorId,
      userId: userId ?? null,
      rating: body.rating,
      comment: body.comment?.trim() ?? "",
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
    },
  });
  const toDisplay = (u: typeof review.user) => {
    if (!u) return { id: "", firstName: "Anonymous", lastName: "", avatar: undefined as string | undefined };
    const first = (u.firstName ?? "").trim();
    const last = (u.lastName ?? "").trim();
    if (first || last) return { id: u.id, firstName: first, lastName: last, avatar: u.avatar ?? undefined };
    const email = (u.email ?? "").trim();
    const fromEmail = email ? email.split("@")[0] : "";
    return { id: u.id, firstName: fromEmail || "Visitor", lastName: "", avatar: u.avatar ?? undefined };
  };
  return {
    id: review.id,
    rating: review.rating ?? 0,
    title: "",
    comment: review.comment ?? "",
    createdAt: review.createdAt.toISOString(),
    user: toDisplay(review.user),
    replies: [],
  };
}

// --- Exhibitor products ---

export async function listExhibitorProducts(exhibitorId: string) {
  if (!exhibitorId) {
    throw new Error("exhibitorId is required");
  }
  const products = await prisma.product.findMany({
    where: { exhibitorId },
    orderBy: { createdAt: "desc" },
  });
  return products.map((p) => toProductShape(p));
}

function toProductShape(p: { id: string; name: string; category: string | null; description: string | null; price: number | null; currency: string | null; images: string[]; brochure: string[]; youtube: string[] }) {
  return {
    id: p.id,
    name: p.name,
    category: p.category ?? undefined,
    description: p.description ?? undefined,
    price: p.price ?? undefined,
    currency: p.currency ?? undefined,
    images: p.images ?? [],
    brochure: p.brochure ?? [],
    youtube: Array.isArray(p.youtube) ? (p.youtube.length > 0 ? String(p.youtube[0]) : "") : "",
  };
}

export async function createExhibitorProduct(
  exhibitorId: string,
  body: {
    name: string;
    category?: string;
    description?: string;
    price?: number;
    currency?: string;
    images?: string[];
    brochure?: string[];
    youtube?: string | string[];
  }
) {
  if (!exhibitorId) {
    throw new Error("exhibitorId is required");
  }
  const youtubeArr = Array.isArray(body.youtube)
    ? body.youtube
    : body.youtube
      ? [body.youtube]
      : [];
  const product = await prisma.product.create({
    data: {
      exhibitorId,
      name: body.name ?? "",
      category: body.category ?? null,
      description: body.description ?? null,
      price: body.price ?? null,
      currency: body.currency ?? null,
      images: body.images ?? [],
      brochure: body.brochure ?? [],
      youtube: youtubeArr,
    },
  });
  return toProductShape(product);
}

export async function updateExhibitorProduct(
  exhibitorId: string,
  productId: string,
  body: Partial<{
    name: string;
    category: string;
    description: string;
    price: number;
    currency: string;
    images: string[];
    brochure: string[];
    youtube: string | string[];
  }>
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, exhibitorId },
  });
  if (!existing) {
    return null;
  }
  const youtubeArr =
    body.youtube !== undefined
      ? Array.isArray(body.youtube)
        ? body.youtube
        : body.youtube
          ? [body.youtube]
          : []
      : undefined;
  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.price !== undefined && { price: body.price }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.images !== undefined && { images: body.images }),
      ...(body.brochure !== undefined && { brochure: body.brochure }),
      ...(youtubeArr !== undefined && { youtube: youtubeArr }),
    },
  });
  return toProductShape(product);
}

export async function deleteExhibitorProduct(exhibitorId: string, productId: string) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, exhibitorId },
  });
  if (!existing) {
    return false;
  }
  await prisma.product.delete({
    where: { id: productId },
  });
  return true;
}

