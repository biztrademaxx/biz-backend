import prisma from "../../../config/prisma";
import { parseListQuery } from "../../../lib/admin-response";
import type { UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { resolveFrontendBase, sendUserAccountAccessEmail } from "../../../services/email.service";
import { generateTempPassword } from "../../../utils/temp-password";

const ROLE: UserRole = "VENUE_MANAGER";

const venueEventListSelect = {
  id: true,
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  category: true,
  eventType: true,
  isVirtual: true,
  venueId: true,
} as const;

function mapVenueEventsForAdmin(
  rows: Array<{
    id: string;
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    status: string;
    category: string[];
    eventType: string[];
    isVirtual: boolean;
    venueId: string | null;
  }>,
  fallbackVenueId: string,
) {
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    status: String(e.status),
    category: e.category ?? [],
    eventType: e.eventType ?? [],
    isVirtual: e.isVirtual,
    venueId: e.venueId ?? fallbackVenueId,
  }));
}

function spaceCapacityFromRow(row: object): number {
  const r = row as Record<string, unknown>;
  for (const key of ["capacity", "maxCapacity", "seatingCapacity", "maxAttendees"] as const) {
    if (!(key in r)) continue;
    const n = Number(r[key]);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}

/** When maxCapacity / totalHalls are unset (or 0), derive from meetingSpaces JSON — mirrors public /venue UI. */
function inferFromMeetingSpaces(meetingSpaces: unknown): { capacity: number; halls: number } {
  if (!Array.isArray(meetingSpaces) || meetingSpaces.length === 0) {
    return { capacity: 0, halls: 0 };
  }
  let capacity = 0;
  for (const row of meetingSpaces) {
    if (row && typeof row === "object") capacity += spaceCapacityFromRow(row as object);
  }
  return { capacity, halls: meetingSpaces.length };
}

/** DB may store 0 while meetingSpaces holds real totals; public venue page treats 0 as missing. */
function resolveCapacityAndHalls(
  maxCapacity: number | null | undefined,
  totalHalls: number | null | undefined,
  meetingSpaces: unknown,
): { maxCapacity: number; totalHalls: number } {
  const inferred = inferFromMeetingSpaces(meetingSpaces);
  let cap = maxCapacity ?? 0;
  let halls = totalHalls ?? 0;
  if (!cap && inferred.capacity > 0) cap = inferred.capacity;
  if (!halls && inferred.halls > 0) halls = inferred.halls;
  return { maxCapacity: cap, totalHalls: halls };
}

async function syncLocationMasterFromVenue(input: {
  venueCountry?: unknown;
  venueState?: unknown;
  venueCity?: unknown;
}) {
  const countryName = String(input.venueCountry ?? "").trim();
  const stateName = String(input.venueState ?? "").trim();
  const cityName = String(input.venueCity ?? "").trim();
  if (!countryName) return;

  const normalizedCode = countryName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "UNK";
  const country = await prisma.country.upsert({
    where: { name: countryName },
    update: {},
    create: {
      name: countryName,
      code: normalizedCode,
      timezone: "UTC",
      currency: "USD",
      isActive: true,
      isPermitted: false,
    },
  });
  if (stateName) {
    await (prisma as any).state.upsert({
      where: { name_countryId: { name: stateName, countryId: country.id } },
      update: {},
      create: {
        name: stateName,
        countryId: country.id,
        isActive: true,
        isPermitted: false,
      },
    });
  }

  if (!cityName || !stateName) return;

  const city = await prisma.city.findFirst({
    where: {
      countryId: country.id,
      name: { equals: cityName, mode: "insensitive" },
    },
  });
  if (!city) {
    await prisma.city.create({
      data: {
        name: cityName,
        state: stateName,
        countryId: country.id,
        timezone: country.timezone || "UTC",
        isActive: true,
        isPermitted: false,
      },
    });
  }
}

export async function listVenues(query: Record<string, unknown>) {
  const { page, limit, search, skip, sort, order } = parseListQuery(query);
  const where: any = { role: ROLE };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { venueName: { contains: search, mode: "insensitive" } },
      { venueCity: { contains: search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort]: order },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        venueName: true,
        venueCity: true,
        venueState: true,
        venueCountry: true,
        venueAddress: true,
        venueWebsite: true,
        maxCapacity: true,
        totalHalls: true,
        averageRating: true,
        totalReviews: true,
        meetingSpaces: true,
        isVerified: true,
        totalEvents: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { venueEvents: true } },
        venueEvents: {
          orderBy: { startDate: "desc" },
          take: 8,
          select: venueEventListSelect,
        },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const data = items.map((u) => {
    const { maxCapacity, totalHalls } = resolveCapacityAndHalls(
      u.maxCapacity,
      u.totalHalls,
      u.meetingSpaces,
    );
    return {
      id: u.id,
      name: u.venueName || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      venueName: u.venueName,
      venueCity: u.venueCity,
      venueState: u.venueState,
      venueCountry: u.venueCountry,
      venueAddress: u.venueAddress,
      website: u.venueWebsite,
      maxCapacity,
      totalHalls,
      averageRating: u.averageRating ?? 0,
      totalReviews: u.totalReviews ?? 0,
      meetingSpaces: u.meetingSpaces,
      isVerified: u.isVerified,
      totalEvents: (u._count?.venueEvents ?? 0) || (u as any).totalEvents || 0,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      events: mapVenueEventsForAdmin((u as any).venueEvents ?? [], u.id),
    };
  });
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getVenueById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: ROLE },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      venueName: true,
      venueCity: true,
      venueState: true,
      venueCountry: true,
      venueAddress: true,
      venueWebsite: true,
      venueDescription: true,
      maxCapacity: true,
      totalHalls: true,
      averageRating: true,
      totalReviews: true,
      meetingSpaces: true,
      amenities: true,
      venueImages: true,
      isVerified: true,
      totalEvents: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { venueEvents: true } },
      venueEvents: {
        orderBy: { startDate: "desc" },
        take: 100,
        select: venueEventListSelect,
      },
    },
  });
  if (!user) return null;
  const { maxCapacity, totalHalls } = resolveCapacityAndHalls(
    user.maxCapacity,
    user.totalHalls,
    user.meetingSpaces,
  );
  const venueEventsList = (user as { venueEvents?: Parameters<typeof mapVenueEventsForAdmin>[0] }).venueEvents ?? [];
  return {
    id: user.id,
    name: user.venueName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    venueName: user.venueName,
    venueCity: user.venueCity,
    venueState: user.venueState,
    venueCountry: user.venueCountry,
    venueAddress: user.venueAddress,
    website: user.venueWebsite,
    description: user.venueDescription,
    maxCapacity,
    totalHalls,
    averageRating: user.averageRating ?? 0,
    totalReviews: user.totalReviews ?? 0,
    meetingSpaces: user.meetingSpaces,
    amenities: user.amenities ?? [],
    venueImages: user.venueImages ?? [],
    isVerified: user.isVerified,
    totalEvents: (user._count?.venueEvents ?? 0) || (user as any).totalEvents || 0,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    events: mapVenueEventsForAdmin(venueEventsList, user.id),
  };
}

export async function createVenue(body: Record<string, unknown>) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  // Prevent duplicate email across any role to avoid unique constraint error
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) throw new Error("Venue with this email already exists");

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      role: ROLE,
      password: hashedPassword,
      emailVerified: false,
      firstName: String(body.firstName ?? body.venueName ?? "").trim() || "Venue",
      lastName: String(body.lastName ?? "").trim() || "",
      phone: body.phone != null ? String(body.phone) : null,
      venueName: body.venueName != null ? String(body.venueName) : null,
      venueCity: body.venueCity != null ? String(body.venueCity) : null,
      venueState: body.venueState != null ? String(body.venueState) : null,
      venueCountry: body.venueCountry != null ? String(body.venueCountry) : null,
      venueAddress: body.venueAddress != null ? String(body.venueAddress) : null,
      maxCapacity: body.maxCapacity != null ? Number(body.maxCapacity) : null,
      isActive: body.isActive !== false,
    },
  });
  await syncLocationMasterFromVenue({
    venueCountry: body.venueCountry,
    venueState: body.venueState,
    venueCity: body.venueCity,
  });
  const venue = await getVenueById(user.id);
  if (!venue) throw new Error("Failed to load venue after create");
  return { venue, tempPassword };
}

export async function updateVenue(id: string, body: Record<string, unknown>) {
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  const allowed = [
    "firstName", "lastName", "phone", "venueName", "venueCity", "venueState",
    "venueCountry", "venueAddress", "maxCapacity", "isActive",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
  await prisma.user.update({ where: { id }, data: data as any });
  await syncLocationMasterFromVenue({
    venueCountry: data.venueCountry,
    venueState: data.venueState,
    venueCity: data.venueCity,
  });
  return getVenueById(id);
}

export async function deleteVenue(id: string) {
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  await prisma.user.delete({ where: { id } });
  return { deleted: true };
}

export async function sendVenueAccountEmail(input: { venueId?: string; venueEmail?: string }) {
  const venueId = String(input.venueId ?? "").trim();
  const venueEmail = String(input.venueEmail ?? "").trim().toLowerCase();
  if (!venueId && !venueEmail) {
    throw new Error("venueId or venueEmail is required");
  }

  const venue = await prisma.user.findFirst({
    where: {
      role: ROLE,
      ...(venueId ? { id: venueId } : {}),
      ...(venueEmail ? { email: venueEmail } : {}),
    },
    select: { id: true, email: true, firstName: true, emailVerified: true, venueName: true },
  });
  if (!venue?.email) throw new Error("Venue manager not found");

  let setPasswordUrl: string | undefined;
  let tempPassword: string | undefined;
  if (!venue.emailVerified) {
    tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: venue.id },
      data: {
        password: hashedPassword,
        resetToken,
        resetTokenExpiry,
        loginAttempts: 0,
      },
    });
    const base = resolveFrontendBase().replace(/\/$/, "");
    setPasswordUrl = `${base}/reset-password?token=${resetToken}&email=${encodeURIComponent(venue.email)}`;
  }

  await sendUserAccountAccessEmail({
    toEmail: venue.email,
    firstName: venue.firstName || venue.venueName || "there",
    roleLabel: "Venue Manager",
    setPasswordUrl,
    tempPassword,
  });
}
