import type { AdminContentType, Prisma } from "@prisma/client";
import prisma from "../../../config/prisma";

const bannerSelect = {
  id: true,
  title: true,
  body: true,
  published: true,
  sortOrder: true,
  extras: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function mapBannerRow(row: {
  id: string;
  title: string | null;
  body: string | null;
  published: boolean;
  sortOrder: number;
  extras: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const ex = (row.extras && typeof row.extras === "object" ? row.extras : {}) as Record<string, unknown>;
  const imageUrl = String(ex.imageUrl ?? "");
  const publicId = String(ex.publicId ?? "");
  const page = String(ex.page ?? "homepage");
  const position = String(ex.position ?? "hero");
  const width = Number(ex.width ?? 1200);
  const height = Number(ex.height ?? 400);
  const linkRaw = ex.link;
  const link =
    typeof linkRaw === "string" && linkRaw.trim()
      ? linkRaw.trim()
      : linkRaw != null && String(linkRaw).trim()
        ? String(linkRaw).trim()
        : undefined;
  return {
    id: row.id,
    title: row.title ?? "Banner",
    description: row.body ?? "",
    imageUrl,
    publicId,
    page,
    position,
    link,
    isActive: row.published,
    width,
    height,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listBannersAdmin() {
  const rows = await prisma.adminContent.findMany({
    where: { type: "BANNER" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: bannerSelect,
  });
  return rows.map(mapBannerRow);
}

export async function listBannersPublic(params: { page?: string; position?: string }) {
  const where: Prisma.AdminContentWhereInput = {
    type: "BANNER",
    published: true,
  };
  const rows = await prisma.adminContent.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: bannerSelect,
  });
  let mapped = rows.map(mapBannerRow);
  if (params.page) mapped = mapped.filter((b) => b.page === params.page);
  if (params.position) mapped = mapped.filter((b) => b.position === params.position);
  return mapped;
}

export async function createBanner(input: {
  title: string;
  description?: string;
  page: string;
  position: string;
  imageUrl: string;
  publicId?: string;
  width?: number;
  height?: number;
  isActive?: boolean;
  link?: string;
}) {
  const extras = {
    page: input.page,
    position: input.position,
    imageUrl: input.imageUrl,
    publicId: input.publicId ?? "",
    width: input.width ?? 1200,
    height: input.height ?? 400,
    ...(input.link != null && String(input.link).trim() ? { link: String(input.link).trim() } : {}),
  };
  const row = await prisma.adminContent.create({
    data: {
      type: "BANNER",
      title: input.title,
      body: input.description?.trim() || null,
      published: input.isActive !== false,
      extras: extras as Prisma.InputJsonValue,
    },
    select: bannerSelect,
  });
  return mapBannerRow(row);
}

export async function patchBanner(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    isActive: boolean;
    page: string;
    position: string;
    imageUrl: string;
    publicId: string;
    link: string;
  }>,
) {
  const existing = await prisma.adminContent.findFirst({
    where: { id, type: "BANNER" },
  });
  if (!existing) return null;
  const ex = (existing.extras && typeof existing.extras === "object" ? existing.extras : {}) as Record<string, unknown>;
  const nextExtras = { ...ex };
  if (patch.page !== undefined) nextExtras.page = patch.page;
  if (patch.position !== undefined) nextExtras.position = patch.position;
  if (patch.imageUrl !== undefined) nextExtras.imageUrl = patch.imageUrl;
  if (patch.publicId !== undefined) nextExtras.publicId = patch.publicId;
  if (patch.link !== undefined) {
    if (patch.link === "" || patch.link == null) delete nextExtras.link;
    else nextExtras.link = patch.link;
  }

  const row = await prisma.adminContent.update({
    where: { id },
    data: {
      title: patch.title !== undefined ? patch.title : undefined,
      body: patch.description !== undefined ? patch.description.trim() || null : undefined,
      published: patch.isActive !== undefined ? patch.isActive : undefined,
      extras: nextExtras as Prisma.InputJsonValue,
    },
    select: bannerSelect,
  });
  return mapBannerRow(row);
}

export async function deleteBanner(id: string) {
  const r = await prisma.adminContent.deleteMany({ where: { id, type: "BANNER" } });
  return r.count > 0;
}

function mapContentItem(row: {
  id: string;
  type: AdminContentType;
  title: string | null;
  slug: string | null;
  body: string | null;
  extras: Prisma.JsonValue | null;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    body: row.body,
    extras: row.extras,
    published: row.published,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listByType(type: AdminContentType) {
  const rows = await prisma.adminContent.findMany({
    where: { type },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(mapContentItem);
}

function slugifyTitle(raw: string): string {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "post";
}

async function ensureUniqueBlogSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug || "post";
  let attempt = 0;
  while (attempt < 100) {
    const existing = await prisma.adminContent.findFirst({
      where: {
        type: "BLOG",
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  return `${baseSlug}-${Date.now()}`;
}

export async function createContentItem(input: {
  type: AdminContentType;
  title?: string;
  slug?: string;
  body?: string;
  extras?: Prisma.InputJsonValue;
  published?: boolean;
  sortOrder?: number;
}) {
  let slug: string | null | undefined = input.slug?.trim() || null;
  if (input.type === "BLOG") {
    const titlePart = input.title?.trim() || "";
    const base = slug ? slugifyTitle(slug) : slugifyTitle(titlePart || "post");
    slug = await ensureUniqueBlogSlug(base);
  }

  const row = await prisma.adminContent.create({
    data: {
      type: input.type,
      title: input.title,
      slug,
      body: input.body,
      extras: input.extras ?? undefined,
      published: input.published ?? false,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return mapContentItem(row);
}

export async function patchContentItem(
  id: string,
  patch: Partial<{
    title: string | null;
    slug: string | null;
    body: string | null;
    extras: Prisma.InputJsonValue;
    published: boolean;
    sortOrder: number;
  }>,
) {
  try {
    const existing = await prisma.adminContent.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Prisma.AdminContentUpdateInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.body !== undefined) data.body = patch.body;
    if (patch.extras !== undefined) data.extras = patch.extras as Prisma.InputJsonValue;
    if (patch.published !== undefined) data.published = patch.published;
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

    if (patch.slug !== undefined) {
      if (existing.type === "BLOG") {
        const raw = String(patch.slug ?? "").trim();
        const base = raw ? slugifyTitle(raw) : slugifyTitle(existing.title?.trim() || "post");
        data.slug = await ensureUniqueBlogSlug(base, id);
      } else {
        data.slug = patch.slug;
      }
    }

    const row = await prisma.adminContent.update({
      where: { id },
      data,
    });
    return mapContentItem(row);
  } catch {
    return null;
  }
}

export async function deleteContentItem(id: string) {
  try {
    await prisma.adminContent.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

function excerptFromBody(body: string | null, max = 200): string {
  if (!body) return "";
  const t = body.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).trim()}…`;
}

function readBlogExtras(extras: Prisma.JsonValue | null): {
  coverImageUrl: string | null;
  coverImagePublicId: string | null;
  author: string | null;
  tag: string | null;
} {
  const ex = extras && typeof extras === "object" ? (extras as Record<string, unknown>) : {};
  return {
    coverImageUrl: typeof ex.coverImageUrl === "string" && ex.coverImageUrl.trim() ? ex.coverImageUrl.trim() : null,
    coverImagePublicId:
      typeof ex.coverImagePublicId === "string" && ex.coverImagePublicId.trim()
        ? ex.coverImagePublicId.trim()
        : null,
    author: typeof ex.author === "string" && ex.author.trim() ? ex.author.trim() : null,
    tag: typeof ex.tag === "string" && ex.tag.trim() ? ex.tag.trim() : null,
  };
}

/** Public listing: published blog posts only. */
export async function listPublishedBlogs() {
  const rows = await prisma.adminContent.findMany({
    where: { type: "BLOG", published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => {
    const { coverImageUrl, coverImagePublicId, author, tag } = readBlogExtras(row.extras);
    const slug = row.slug?.trim();
    return {
      id: row.id,
      title: row.title?.trim() || "Untitled",
      slug: slug || row.id,
      excerpt: excerptFromBody(row.body),
      coverImageUrl,
      ...(coverImagePublicId ? { coverImagePublicId } : {}),
      author: author ?? "Editorial",
      tag,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/** Public detail by slug (published only). Also accepts post id when slug is missing in legacy rows. */
export async function getPublishedBlogBySlug(slug: string) {
  const s = slug.trim();
  if (!s) return null;

  const bySlug = await prisma.adminContent.findFirst({
    where: { type: "BLOG", published: true, slug: s },
  });
  const row =
    bySlug ??
    (await prisma.adminContent.findFirst({
      where: { type: "BLOG", published: true, id: s },
    }));
  if (!row) return null;

  const { coverImageUrl, coverImagePublicId, author, tag } = readBlogExtras(row.extras);
  return {
    id: row.id,
    title: row.title?.trim() || "Untitled",
    slug: row.slug ?? s,
    body: row.body ?? "",
    coverImageUrl,
    ...(coverImagePublicId ? { coverImagePublicId } : {}),
    author: author ?? "Editorial",
    tag,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
