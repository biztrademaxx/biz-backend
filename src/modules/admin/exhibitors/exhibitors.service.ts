import prisma from "../../../config/prisma";
import { parseListQuery } from "../../../lib/admin-response";
import type { UserRole } from "@prisma/client";

const ROLE: UserRole = "EXHIBITOR";

export async function listExhibitors(query: Record<string, unknown>) {
  const { page, limit, search, skip, sort, order } = parseListQuery(query);
  const where: any = { role: ROLE };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
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
        company: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);
  const data = items.map((u) => ({
    id: u.id,
    name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    company: u.company,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getExhibitorById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: ROLE },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    company: user.company,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function createExhibitor(body: Record<string, unknown>) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Email is required");
  const existing = await prisma.user.findFirst({ where: { email, role: ROLE } });
  if (existing) throw new Error("Exhibitor with this email already exists");
  const user = await prisma.user.create({
    data: {
      email,
      role: ROLE,
      firstName: String(body.firstName ?? "").trim() || "Exhibitor",
      lastName: String(body.lastName ?? "").trim() || "",
      phone: body.phone != null ? String(body.phone) : null,
      company: body.company != null ? String(body.company) : null,
      companyIndustry: body.companyIndustry != null ? String(body.companyIndustry) : null,
      jobTitle: body.jobTitle != null ? String(body.jobTitle) : null,
      website: body.website != null ? String(body.website) : null,
      linkedin: body.linkedin != null ? String(body.linkedin) : null,
      twitter: body.twitter != null ? String(body.twitter) : null,
      location: body.location != null ? String(body.location) : null,
      businessEmail: body.businessEmail != null ? String(body.businessEmail) : null,
      businessPhone: body.businessPhone != null ? String(body.businessPhone) : null,
      businessAddress: body.businessAddress != null ? String(body.businessAddress) : null,
      taxId: body.taxId != null ? String(body.taxId) : null,
      bio: body.bio != null ? String(body.bio) : null,
      isActive: body.isActive !== false,
    },
  });
  return getExhibitorById(user.id);
}

export async function updateExhibitor(id: string, body: Record<string, unknown>) {
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  const allowed = [
    "firstName",
    "lastName",
    "phone",
    "company",
    "companyIndustry",
    "jobTitle",
    "website",
    "linkedin",
    "twitter",
    "location",
    "businessEmail",
    "businessPhone",
    "businessAddress",
    "taxId",
    "bio",
    "isActive",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
  await prisma.user.update({ where: { id }, data: data as any });
  return getExhibitorById(id);
}

export async function deleteExhibitor(id: string) {
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  await prisma.user.delete({ where: { id } });
  return { deleted: true };
}

export async function getExhibitorStats() {
  const [total, active] = await Promise.all([
    prisma.user.count({ where: { role: ROLE } }),
    prisma.user.count({ where: { role: ROLE, isActive: true } }),
  ]);
  return { total, active };
}

// ---------- Exhibitor feedback (admin dashboard: organizer feedback page) ----------

export type AdminExhibitorFeedbackItem = {
  id: string;
  organizer: { id: string; name: string; email: string };
  exhibitor: { id: string; name: string; email: string };
  event: { id: string | null; title: string | null };
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  isPublic: boolean;
  createdAt: string;
};

export async function listExhibitorFeedbackForAdmin(): Promise<AdminExhibitorFeedbackItem[]> {
  const reviews = await prisma.review.findMany({
    where: { exhibitorId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      event: {
        select: {
          id: true,
          title: true,
          organizerId: true,
          organizer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  const exhibitorIds = [...new Set(reviews.map((r) => r.exhibitorId).filter(Boolean) as string[])];
  const exhibitors =
    exhibitorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: exhibitorIds } },
          select: { id: true, firstName: true, lastName: true, email: true, company: true },
        })
      : [];
  const exhibitorMap = new Map(exhibitors.map((e) => [e.id, e]));

  const name = (first: string | null, last: string | null, fallback: string) =>
    `${first ?? ""} ${last ?? ""}`.trim() || fallback;

  return reviews.map((r) => {
    const organizer = r.event?.organizer;
    const exhibitor = r.exhibitorId ? exhibitorMap.get(r.exhibitorId) : null;
    return {
      id: r.id,
      organizer: organizer
        ? {
            id: organizer.id,
            name: name(organizer.firstName, organizer.lastName, "Organizer"),
            email: organizer.email ?? "",
          }
        : { id: "", name: "—", email: "" },
      user: r.user
        ? {
            id: r.user.id,
            firstName: r.user.firstName ?? "",
            lastName: r.user.lastName ?? "",
            email: r.user.email ?? "",
          }
        : { id: "", firstName: "", lastName: "", email: "" },
      exhibitor: exhibitor
        ? {
            id: exhibitor.id,
            firstName: exhibitor.firstName ?? "",
            lastName: exhibitor.lastName ?? "",
            email: exhibitor.email ?? "",
            company: exhibitor.company ?? "",
            name: name(exhibitor.firstName, exhibitor.lastName, "Exhibitor"),
          }
        : {
            id: r.exhibitorId ?? "",
            firstName: "",
            lastName: "",
            email: "",
            company: "",
            name: "—",
          },
      event: r.event
        ? { id: r.event.id, title: r.event.title }
        : { id: null, title: null },
      rating: r.rating ?? 0,
      title: null,
      comment: r.comment ?? null,
      isApproved: true,
      isPublic: true,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

// ---------- Admin exhibitor appointments (list all for admin dashboard) ----------

export async function listExhibitorAppointmentsForAdmin() {
  const appointments = await prisma.appointment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      exhibitor: {
        select: { id: true, firstName: true, lastName: true, email: true, company: true, avatar: true },
      },
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      event: { select: { id: true, title: true } },
    },
  });
  const name = (first: string | null, last: string | null) =>
    `${first ?? ""} ${last ?? ""}`.trim() || "—";
  return appointments.map((apt) => {
    const reqDate = apt.requestedDate ? new Date(apt.requestedDate) : new Date();
    const reqTime = apt.requestedTime || "09:00";
    const scheduledAt = new Date(`${reqDate.toISOString().split("T")[0]}T${reqTime}:00.000Z`);
    return {
      id: apt.id,
      exhibitor: {
        id: apt.exhibitor.id,
        companyName: apt.exhibitor.company ?? name(apt.exhibitor.firstName, apt.exhibitor.lastName),
        email: apt.exhibitor.email ?? "",
        logo: apt.exhibitor.avatar ?? undefined,
      },
      visitor: {
        id: apt.requester.id,
        name: name(apt.requester.firstName, apt.requester.lastName),
        email: apt.requester.email ?? "",
      },
      event: {
        id: apt.event.id,
        name: apt.event.title,
      },
      scheduledAt: scheduledAt.toISOString(),
      duration: apt.duration ?? 60,
      status: apt.status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED",
      meetingType: (apt.meetingType as "IN_PERSON" | "VIRTUAL") ?? "IN_PERSON",
      location: apt.location ?? undefined,
      notes: apt.notes ?? undefined,
      cancelReason: apt.cancellationReason ?? undefined,
      cancelledAt: apt.cancelledAt?.toISOString(),
      createdAt: apt.createdAt.toISOString(),
    };
  });
}
