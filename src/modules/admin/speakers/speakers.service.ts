import prisma from "../../../config/prisma";
import { invalidateSpeakerCaches } from "../../../config/redis";
import { parseListQuery } from "../../../lib/admin-response";
import type { UserRole } from "@prisma/client";

const ROLE: UserRole = "SPEAKER";

export async function listSpeakers(query: Record<string, unknown>) {
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

export async function getSpeakerById(id: string) {
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
    jobTitle: user.jobTitle,
    location: user.location,
    website: user.website,
    linkedin: user.linkedin,
    twitter: user.twitter,
    instagram: user.instagram,
    avatar: user.avatar,
    isActive: user.isActive,
    bio: user.bio,
    speakingExperience: user.speakingExperience,
    specialties: user.specialties,
    achievements: user.achievements,
    certifications: user.certifications,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function optStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function createSpeaker(body: Record<string, unknown>) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const anyWithEmail = await prisma.user.findFirst({ where: { email } });
  if (anyWithEmail) {
    if (anyWithEmail.role === ROLE) throw new Error("Speaker with this email already exists");
    throw new Error("An account with this email already exists");
  }

  const passwordRaw = optStr(body.password);
  const password = passwordRaw ?? "TEMP_PASSWORD";

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: ROLE,
      firstName: String(body.firstName ?? "").trim() || "Speaker",
      lastName: String(body.lastName ?? "").trim() || "",
      phone: optStr(body.phone),
      company: optStr(body.company),
      jobTitle: optStr(body.jobTitle),
      location: optStr(body.location),
      website: optStr(body.website),
      linkedin: optStr(body.linkedin),
      twitter: optStr(body.twitter),
      instagram: optStr(body.instagram),
      avatar: optStr(body.avatar),
      bio: optStr(body.bio),
      speakingExperience: optStr(body.speakingExperience),
      specialties: strArray(body.specialties ?? body.categories),
      achievements: strArray(body.achievements),
      certifications: strArray(body.certifications),
      interests: strArray(body.interests),
      timezone: optStr(body.timezone) ?? "UTC",
      language: optStr(body.language) ?? "en",
      isVerified: body.isVerified === true,
      isActive: body.isActive !== false,
    },
  });
  await invalidateSpeakerCaches();
  return getSpeakerById(user.id);
}

export async function updateSpeaker(id: string, body: Record<string, unknown>) {
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  const allowed = [
    "firstName",
    "lastName",
    "phone",
    "company",
    "jobTitle",
    "location",
    "website",
    "linkedin",
    "twitter",
    "instagram",
    "avatar",
    "isActive",
    "bio",
    "speakingExperience",
    "specialties",
    "achievements",
    "certifications",
  ];
  const arrayKeys = new Set(["specialties", "achievements", "certifications"]);
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) {
      data[k] = arrayKeys.has(k) ? strArray(body[k]) : body[k];
    }
  }
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
  await prisma.user.update({ where: { id }, data: data as any });
  await invalidateSpeakerCaches();
  return getSpeakerById(id);
}

export async function deleteSpeaker(id: string) {
  const existing = await prisma.user.findFirst({ where: { id, role: ROLE } });
  if (!existing) return null;
  await prisma.user.delete({ where: { id } });
  await invalidateSpeakerCaches();
  return { deleted: true };
}
