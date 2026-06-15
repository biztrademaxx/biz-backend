import prisma from "../../../config/prisma";
import {
  adminOrganizersListCacheKey,
  cached,
  CACHE_TTL,
  invalidateAdminOrganizerCaches,
  invalidateOrganizerCaches,
} from "../../../config/redis";
import { parseListQuery } from "../../../lib/admin-response";
import type { Prisma, UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { resolveFrontendBase, sendUserAccountAccessEmail } from "../../../services/email.service";
import {
  applyOrganizerLocationBodyAliases,
  resolveOrganizerLocationFields,
} from "../../../utils/organizer-location-resolve";

const ROLE: UserRole = "ORGANIZER";

/** Lighter projection for paginated admin list (table + inline view dialog). */
const ORGANIZER_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  company: true,
  avatar: true,
  isActive: true,
  isVerified: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  organizationName: true,
  description: true,
  headquarters: true,
  location: true,
  organizerCountry: true,
  organizerState: true,
  organizerCity: true,
  specialties: true,
  certifications: true,
  businessPhone: true,
  businessAddress: true,
  totalEvents: true,
  activeEvents: true,
  totalAttendees: true,
  totalRevenue: true,
  averageRating: true,
  totalReviews: true,
  _count: {
    select: {
      organizedEvents: true,
    },
  },
} as const;

const ORGANIZER_ADMIN_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  company: true,
  avatar: true,
  role: true,
  isActive: true,
  isVerified: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  organizationName: true,
  description: true,
  headquarters: true,
  location: true,
  organizerCountry: true,
  organizerState: true,
  organizerCity: true,
  profileCountry: true,
  profileState: true,
  profileCity: true,
  website: true,
  founded: true,
  teamSize: true,
  specialties: true,
  achievements: true,
  certifications: true,
  businessEmail: true,
  businessPhone: true,
  businessAddress: true,
  taxId: true,
  totalEvents: true,
  activeEvents: true,
  totalAttendees: true,
  totalRevenue: true,
  averageRating: true,
  totalReviews: true,
  _count: {
    select: {
      organizedEvents: true,
    },
  },
} as const;

type OrganizerAdminRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  avatar: string | null;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizationName: string | null;
  description: string | null;
  headquarters: string | null;
  location: string | null;
  organizerCountry: string | null;
  organizerState: string | null;
  organizerCity: string | null;
  profileCountry: string | null;
  profileState: string | null;
  profileCity: string | null;
  website: string | null;
  founded: string | null;
  teamSize: string | null;
  specialties: string[];
  achievements: string[];
  certifications: string[];
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  taxId: string | null;
  totalEvents: number;
  activeEvents: number;
  totalAttendees: number;
  totalRevenue: number;
  averageRating: number | null;
  totalReviews: number | null;
  _count?: { organizedEvents: number };
};

function mapOrganizerForAdmin(u: OrganizerAdminRow) {
  const loc = resolveOrganizerLocationFields(u);
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    company: u.company,
    avatar: u.avatar,
    role: u.role,
    isActive: u.isActive,
    isVerified: u.isVerified,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    organizationName: u.organizationName,
    description: u.description,
    headquarters: u.headquarters,
    location: u.location,
    organizerCountry: loc.organizerCountry || null,
    organizerState: loc.organizerState || null,
    organizerCity: loc.organizerCity || null,
    website: u.website,
    founded: u.founded,
    teamSize: u.teamSize,
    specialties: u.specialties,
    achievements: u.achievements,
    certifications: u.certifications,
    businessEmail: u.businessEmail,
    businessPhone: u.businessPhone,
    businessAddress: u.businessAddress,
    taxId: u.taxId,
    totalEvents: u._count?.organizedEvents ?? u.totalEvents,
    activeEvents: u.activeEvents,
    totalAttendees: u.totalAttendees,
    totalRevenue: u.totalRevenue,
    averageRating: u.averageRating ?? 0,
    totalReviews: u.totalReviews ?? 0,
    _count: u._count,
  };
}

export async function listOrganizers(query: Record<string, unknown>) {
  const key = await adminOrganizersListCacheKey(query);
  return cached(key, CACHE_TTL.ADMIN_ORGANIZERS_LIST, () => listOrganizersFromDb(query));
}

async function listOrganizersFromDb(query: Record<string, unknown>) {
  const { page, limit, search, skip, sort, order } = parseListQuery(query);
  const country = String(query.country ?? "").trim();
  const where: any = { role: ROLE };
  const filters: Record<string, unknown>[] = [];

  if (search) {
    filters.push({
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { organizationName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (country && country.toLowerCase() !== "all") {
    filters.push({
      OR: [
        { organizerCountry: { equals: country, mode: "insensitive" } },
        { location: { contains: country, mode: "insensitive" } },
        { headquarters: { contains: country, mode: "insensitive" } },
        { businessAddress: { contains: country, mode: "insensitive" } },
      ],
    });
  }

  if (filters.length > 0) {
    where.AND = filters;
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort]: order },
      select: ORGANIZER_LIST_SELECT,
    }),
    prisma.user.count({ where }),
  ]);
  const data = items.map((u) => mapOrganizerForAdmin(u as OrganizerAdminRow));
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getOrganizerById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: ROLE },
    select: ORGANIZER_ADMIN_SELECT,
  });
  if (!user) return null;
  const mapped = mapOrganizerForAdmin(user as OrganizerAdminRow);
  return {
    ...mapped,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
  };
}

export async function createOrganizer(body: Record<string, unknown>) {
  applyOrganizerLocationBodyAliases(body);
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  const existing = await prisma.user.findFirst({ where: { email, role: ROLE } });
  if (existing) throw new Error("Organizer with this email already exists");

  const organizerCity = body.organizerCity != null ? String(body.organizerCity).trim() : "";
  const organizerState = body.organizerState != null ? String(body.organizerState).trim() : "";
  const organizerCountry = body.organizerCountry != null ? String(body.organizerCountry).trim() : "";
  const locationLine = [organizerCity, organizerState, organizerCountry].filter(Boolean).join(", ");

  const user = await prisma.user.create({
    data: {
      email,
      role: ROLE,
      firstName: String(body.firstName ?? "").trim() || "Organizer",
      lastName: String(body.lastName ?? "").trim() || "",
      phone: body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null,
      website: body.website != null && String(body.website).trim() ? String(body.website).trim() : null,
      company: body.company != null ? String(body.company) : null,
      organizationName:
        body.organizationName != null ? String(body.organizationName) : body.company != null ? String(body.company) : null,
      description: body.description != null ? String(body.description) : null,
      headquarters: body.headquarters != null ? String(body.headquarters) : null,
      organizerCity: organizerCity || null,
      organizerState: organizerState || null,
      organizerCountry: organizerCountry || null,
      location: locationLine || null,
      founded: body.founded != null ? String(body.founded) : null,
      teamSize: body.teamSize != null ? String(body.teamSize) : null,
      specialties: Array.isArray(body.specialties) ? body.specialties.map((s) => String(s)) : [],
      businessEmail: body.businessEmail != null ? String(body.businessEmail) : null,
      businessPhone: body.businessPhone != null ? String(body.businessPhone) : null,
      businessAddress: body.businessAddress != null ? String(body.businessAddress) : null,
      taxId: body.taxId != null ? String(body.taxId) : null,
      isActive: body.isActive !== false,
      isVerified: body.isVerified === true,
    },
  });
  await invalidateOrganizerCaches({ id: user.id });
  await invalidateAdminOrganizerCaches();
  return getOrganizerById(user.id);
}

export async function updateOrganizer(id: string, body: Record<string, unknown>) {
  applyOrganizerLocationBodyAliases(body);
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  const allowed = [
    "firstName",
    "lastName",
    "phone",
    "avatar",
    "company",
    "organizationName",
    "description",
    "headquarters",
    "organizerCountry",
    "organizerState",
    "organizerCity",
    "location",
    "founded",
    "teamSize",
    "businessEmail",
    "businessPhone",
    "businessAddress",
    "taxId",
    "isActive",
    "isVerified",
    "website",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (
    body.organizerCountry !== undefined ||
    body.organizerState !== undefined ||
    body.organizerCity !== undefined
  ) {
    const city =
      body.organizerCity !== undefined
        ? String(body.organizerCity).trim()
        : (existing.organizerCity ?? "");
    const state =
      body.organizerState !== undefined
        ? String(body.organizerState).trim()
        : (existing.organizerState ?? "");
    const country =
      body.organizerCountry !== undefined
        ? String(body.organizerCountry).trim()
        : (existing.organizerCountry ?? "");
    const locationLine = [city, state, country].filter(Boolean).join(", ");
    data.location = locationLine || null;
  }
  if (body.specialties !== undefined) {
    data.specialties = Array.isArray(body.specialties) ? body.specialties.map((s) => String(s)) : [];
  }
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
  await prisma.user.update({ where: { id }, data: data as any });
  await invalidateOrganizerCaches({ id });
  await invalidateAdminOrganizerCaches();
  return getOrganizerById(id);
}

export async function deleteOrganizer(id: string) {
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  await prisma.user.delete({ where: { id } });
  await invalidateOrganizerCaches({ id });
  await invalidateAdminOrganizerCaches();
  return { deleted: true };
}

export async function sendOrganizerAccountEmail(input: { organizerId?: string; organizerEmail?: string }) {
  const organizerId = String(input.organizerId ?? "").trim();
  const organizerEmail = String(input.organizerEmail ?? "").trim().toLowerCase();
  if (!organizerId && !organizerEmail) {
    throw new Error("organizerId or organizerEmail is required");
  }

  const organizer = await prisma.user.findFirst({
    where: {
      role: ROLE,
      ...(organizerId ? { id: organizerId } : {}),
      ...(organizerEmail ? { email: organizerEmail } : {}),
    },
    select: { id: true, email: true, firstName: true },
  });
  if (!organizer?.email) throw new Error("Organizer not found");

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: organizer.id },
    data: { resetToken, resetTokenExpiry },
  });

  const base = resolveFrontendBase().replace(/\/$/, "");
  const resetPasswordUrl = `${base}/reset-password?token=${resetToken}&email=${encodeURIComponent(organizer.email)}`;

  await sendUserAccountAccessEmail({
    toEmail: organizer.email,
    firstName: organizer.firstName || "there",
    roleLabel: "Organizer",
    resetPasswordUrl,
  });
}

// ---------- Organizer followers / connections (admin dashboard) ----------

type AdminOrganizerConnectionSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
  organizationName: string | null;
  totalFollowers: number;
  totalEvents: number;
  activeEvents: number;
  createdAt: string;
};

type AdminOrganizerFollower = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
  role: string;
  followedAt: string;
};

type OrganizerConnectionsStats = {
  totalOrganizers: number;
  totalFollowers: number;
  avgFollowersPerOrganizer: number;
  topOrganizer: {
    firstName: string | null;
    lastName: string | null;
    totalFollowers: number;
  } | null;
};

async function getOrganizerConnectionsStatsForAdmin(): Promise<OrganizerConnectionsStats> {
  const [totalOrganizers, followerGroups] = await Promise.all([
    prisma.user.count({ where: { role: ROLE } }),
    prisma.follow.groupBy({
      by: ["followingId"],
      _count: { _all: true },
    }),
  ]);

  const totalFollowers = followerGroups.reduce((sum, row) => sum + (row._count._all ?? 0), 0);
  const avgFollowersPerOrganizer =
    totalOrganizers > 0 ? Math.round(totalFollowers / totalOrganizers) : 0;

  let topOrganizer: OrganizerConnectionsStats["topOrganizer"] = null;
  if (followerGroups.length > 0) {
    const topRow = followerGroups.reduce((max, row) =>
      (row._count._all ?? 0) > (max._count._all ?? 0) ? row : max,
    );
    const topUser = await prisma.user.findFirst({
      where: { id: topRow.followingId, role: ROLE },
      select: { firstName: true, lastName: true },
    });
    if (topUser) {
      topOrganizer = {
        firstName: topUser.firstName,
        lastName: topUser.lastName,
        totalFollowers: topRow._count._all ?? 0,
      };
    }
  }

  return { totalOrganizers, totalFollowers, avgFollowersPerOrganizer, topOrganizer };
}

export async function listOrganizerConnectionsForAdmin(query: Record<string, unknown> = {}) {
  const { page, limit, search, skip } = parseListQuery(query);
  const where: Prisma.UserWhereInput = { role: ROLE };

  if (search) {
    where.AND = [
      {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { organizationName: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [organizers, total, stats] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        organizationName: true,
        createdAt: true,
        totalEvents: true,
        activeEvents: true,
      },
    }),
    prisma.user.count({ where }),
    getOrganizerConnectionsStatsForAdmin(),
  ]);

  const organizerIds = organizers.map((org) => org.id);
  const followerCounts = new Map<string, number>();

  if (organizerIds.length > 0) {
    const grouped = await prisma.follow.groupBy({
      by: ["followingId"],
      where: { followingId: { in: organizerIds } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      followerCounts.set(row.followingId, row._count._all ?? 0);
    }
  }

  const data: AdminOrganizerConnectionSummary[] = organizers.map((org) => ({
    id: org.id,
    firstName: org.firstName,
    lastName: org.lastName,
    email: org.email ?? "",
    avatar: org.avatar,
    organizationName: org.organizationName ?? null,
    totalFollowers: followerCounts.get(org.id) ?? 0,
    totalEvents: org.totalEvents,
    activeEvents: org.activeEvents,
    createdAt: org.createdAt.toISOString(),
  }));

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    stats,
  };
}

export async function getOrganizerConnectionsDetailForAdmin(
  organizerId: string,
): Promise<{ organizer: AdminOrganizerConnectionSummary; followers: AdminOrganizerFollower[] } | null> {
  const organizer = await prisma.user.findFirst({
    where: { id: organizerId, role: ROLE },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      organizationName: true,
      createdAt: true,
      totalEvents: true,
      activeEvents: true,
    },
  });

  if (!organizer) return null;

  const [followersCount, followersRaw] = await Promise.all([
    prisma.follow.count({ where: { followingId: organizer.id } }),
    prisma.follow.findMany({
      where: { followingId: organizer.id },
      take: 50,
      include: {
        follower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const followers: AdminOrganizerFollower[] = followersRaw
    .filter((f) => !!f.follower)
    .map((f) => ({
      id: f.follower.id,
      firstName: f.follower.firstName,
      lastName: f.follower.lastName,
      email: f.follower.email ?? "",
      avatar: f.follower.avatar,
      role: String(f.follower.role),
      followedAt: f.createdAt.toISOString(),
    }));

  const organizerSummary: AdminOrganizerConnectionSummary = {
    id: organizer.id,
    firstName: organizer.firstName,
    lastName: organizer.lastName,
    email: organizer.email ?? "",
    avatar: organizer.avatar,
    organizationName: organizer.organizationName ?? null,
    totalFollowers: followersCount,
    totalEvents: organizer.totalEvents,
    activeEvents: organizer.activeEvents,
    createdAt: organizer.createdAt.toISOString(),
  };

  return { organizer: organizerSummary, followers };
}

// ---------- Venue bookings (admin dashboard) ----------

export type AdminVenueBookingItem = {
  id: string;
  venue: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    venueName: string | null;
    venueAddress: string | null;
    venueCity: string | null;
  };
  visitor?: { id: string; firstName: string | null; lastName: string | null; email: string | null };
  startDate: string;
  endDate: string;
  totalAmount: number;
  currency: string;
  status: string;
  purpose: string | null;
  specialRequests: string;
  meetingSpacesInterested: string[];
  requestedTime: string;
  duration: number;
  createdAt: string;
};

export async function listVenueBookingsForAdmin(): Promise<AdminVenueBookingItem[]> {
  const appointments = await prisma.venueAppointment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      venue: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          venueName: true,
          venueAddress: true,
          venueCity: true,
        },
      },
      visitor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return appointments.map((a) => {
    const start = new Date(a.requestedDate);
    const end = new Date(start.getTime() + (a.duration ?? 30) * 60 * 1000);
    return {
      id: a.id,
      venue: {
        id: a.venue.id,
        firstName: a.venue.firstName,
        lastName: a.venue.lastName,
        venueName: a.venue.venueName ?? null,
        venueAddress: a.venue.venueAddress ?? null,
        venueCity: a.venue.venueCity ?? null,
      },
      visitor: a.visitor
        ? {
            id: a.visitor.id,
            firstName: a.visitor.firstName,
            lastName: a.visitor.lastName,
            email: a.visitor.email ?? null,
          }
        : undefined,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalAmount: 0,
      currency: "USD",
      status: a.status,
      purpose: a.purpose ?? null,
      specialRequests: a.notes ?? "",
      meetingSpacesInterested: [],
      requestedTime: a.requestedTime,
      duration: a.duration ?? 30,
      createdAt: a.createdAt.toISOString(),
    };
  });
}

// ---------- Organizer / event feedback (admin dashboard) ----------

export type AdminOrganizerEventFeedbackItem = {
  id: string;
  organizer: { id: string; name: string; email: string };
  event: { id: string | null; title: string | null };
  reviewer: { id: string; name: string; email: string };
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

function feedbackDisplayName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback: string,
) {
  return `${first ?? ""} ${last ?? ""}`.trim() || fallback;
}

export async function listOrganizerEventFeedbackForAdmin(): Promise<AdminOrganizerEventFeedbackItem[]> {
  const reviews = await prisma.review.findMany({
    where: {
      exhibitorId: null,
      venueId: null,
      OR: [{ eventId: { not: null } }, { organizerId: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      event: {
        select: {
          id: true,
          title: true,
          organizer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  const organizerIds = [
    ...new Set(reviews.map((r) => r.organizerId).filter(Boolean) as string[]),
  ];
  const organizers =
    organizerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: organizerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
  const organizerMap = new Map(organizers.map((o) => [o.id, o]));

  return reviews.map((r) => {
    const fromEvent = r.event?.organizer;
    const fromOrganizerId = r.organizerId ? organizerMap.get(r.organizerId) : null;
    const organizerUser = fromEvent ?? fromOrganizerId;

    return {
      id: r.id,
      organizer: organizerUser
        ? {
            id: organizerUser.id,
            name: feedbackDisplayName(
              organizerUser.firstName,
              organizerUser.lastName,
              "Organizer",
            ),
            email: organizerUser.email ?? "",
          }
        : { id: "", name: "—", email: "" },
      event: r.event
        ? { id: r.event.id, title: r.event.title }
        : { id: null, title: null },
      reviewer: r.user
        ? {
            id: r.user.id,
            name: feedbackDisplayName(r.user.firstName, r.user.lastName, "Visitor"),
            email: r.user.email ?? "",
          }
        : { id: "", name: "Anonymous", email: "" },
      rating: r.rating ?? 0,
      title: r.title ?? null,
      comment: r.comment ?? null,
      isApproved: r.isApproved,
      isPublic: r.isPublic,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

export async function updateOrganizerEventFeedbackById(
  id: string,
  body: { action?: string; isApproved?: boolean; isPublic?: boolean; reason?: string },
) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return null;
  if (review.exhibitorId || review.venueId) return null;

  const reject = body.action === "reject" || body.action === "rejected";
  const approve =
    body.action === "approve" || body.action === "approved" || body.isApproved === true;

  await prisma.review.update({
    where: { id },
    data: {
      isApproved: reject ? false : approve ? true : review.isApproved,
      ...(reject && { isPublic: false }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
    },
  });

  return { success: true, id };
}
