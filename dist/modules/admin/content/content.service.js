"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBannerRow = mapBannerRow;
exports.listBannersAdmin = listBannersAdmin;
exports.listBannersPublic = listBannersPublic;
exports.createBanner = createBanner;
exports.patchBanner = patchBanner;
exports.deleteBanner = deleteBanner;
exports.listByType = listByType;
exports.createContentItem = createContentItem;
exports.patchContentItem = patchContentItem;
exports.deleteContentItem = deleteContentItem;
exports.listPublishedBlogs = listPublishedBlogs;
exports.getPublishedBlogBySlug = getPublishedBlogBySlug;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const bannerSelect = {
    id: true,
    title: true,
    body: true,
    published: true,
    sortOrder: true,
    extras: true,
    createdAt: true,
    updatedAt: true,
};
function mapBannerRow(row) {
    const ex = (row.extras && typeof row.extras === "object" ? row.extras : {});
    const imageUrl = String(ex.imageUrl ?? "");
    const publicId = String(ex.publicId ?? "");
    const page = String(ex.page ?? "homepage");
    const position = String(ex.position ?? "hero");
    const width = Number(ex.width ?? 1200);
    const height = Number(ex.height ?? 400);
    const linkRaw = ex.link;
    const link = typeof linkRaw === "string" && linkRaw.trim()
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
async function listBannersAdmin() {
    const rows = await prisma_1.default.adminContent.findMany({
        where: { type: "BANNER" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: bannerSelect,
    });
    return rows.map(mapBannerRow);
}
async function listBannersPublic(params) {
    const where = {
        type: "BANNER",
        published: true,
    };
    const rows = await prisma_1.default.adminContent.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: bannerSelect,
    });
    let mapped = rows.map(mapBannerRow);
    if (params.page)
        mapped = mapped.filter((b) => b.page === params.page);
    if (params.position)
        mapped = mapped.filter((b) => b.position === params.position);
    return mapped;
}
async function createBanner(input) {
    const extras = {
        page: input.page,
        position: input.position,
        imageUrl: input.imageUrl,
        publicId: input.publicId ?? "",
        width: input.width ?? 1200,
        height: input.height ?? 400,
        ...(input.link != null && String(input.link).trim() ? { link: String(input.link).trim() } : {}),
    };
    const row = await prisma_1.default.adminContent.create({
        data: {
            type: "BANNER",
            title: input.title,
            body: input.description?.trim() || null,
            published: input.isActive !== false,
            extras: extras,
        },
        select: bannerSelect,
    });
    return mapBannerRow(row);
}
async function patchBanner(id, patch) {
    const existing = await prisma_1.default.adminContent.findFirst({
        where: { id, type: "BANNER" },
    });
    if (!existing)
        return null;
    const ex = (existing.extras && typeof existing.extras === "object" ? existing.extras : {});
    const nextExtras = { ...ex };
    if (patch.page !== undefined)
        nextExtras.page = patch.page;
    if (patch.position !== undefined)
        nextExtras.position = patch.position;
    if (patch.imageUrl !== undefined)
        nextExtras.imageUrl = patch.imageUrl;
    if (patch.publicId !== undefined)
        nextExtras.publicId = patch.publicId;
    if (patch.link !== undefined) {
        if (patch.link === "" || patch.link == null)
            delete nextExtras.link;
        else
            nextExtras.link = patch.link;
    }
    const row = await prisma_1.default.adminContent.update({
        where: { id },
        data: {
            title: patch.title !== undefined ? patch.title : undefined,
            body: patch.description !== undefined ? patch.description.trim() || null : undefined,
            published: patch.isActive !== undefined ? patch.isActive : undefined,
            extras: nextExtras,
        },
        select: bannerSelect,
    });
    return mapBannerRow(row);
}
async function deleteBanner(id) {
    const r = await prisma_1.default.adminContent.deleteMany({ where: { id, type: "BANNER" } });
    return r.count > 0;
}
function mapContentItem(row) {
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
async function listByType(type) {
    const rows = await prisma_1.default.adminContent.findMany({
        where: { type },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(mapContentItem);
}
function slugifyTitle(raw) {
    const s = raw
        .toLowerCase()
        .trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return s || "post";
}
async function ensureUniqueBlogSlug(baseSlug, excludeId) {
    let slug = baseSlug || "post";
    let attempt = 0;
    while (attempt < 100) {
        const existing = await prisma_1.default.adminContent.findFirst({
            where: {
                type: "BLOG",
                slug,
                ...(excludeId ? { NOT: { id: excludeId } } : {}),
            },
        });
        if (!existing)
            return slug;
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
    }
    return `${baseSlug}-${Date.now()}`;
}
async function createContentItem(input) {
    let slug = input.slug?.trim() || null;
    if (input.type === "BLOG") {
        const titlePart = input.title?.trim() || "";
        const base = slug ? slugifyTitle(slug) : slugifyTitle(titlePart || "post");
        slug = await ensureUniqueBlogSlug(base);
    }
    const row = await prisma_1.default.adminContent.create({
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
async function patchContentItem(id, patch) {
    try {
        const existing = await prisma_1.default.adminContent.findUnique({ where: { id } });
        if (!existing)
            return null;
        const data = {};
        if (patch.title !== undefined)
            data.title = patch.title;
        if (patch.body !== undefined)
            data.body = patch.body;
        if (patch.extras !== undefined)
            data.extras = patch.extras;
        if (patch.published !== undefined)
            data.published = patch.published;
        if (patch.sortOrder !== undefined)
            data.sortOrder = patch.sortOrder;
        if (patch.slug !== undefined) {
            if (existing.type === "BLOG") {
                const raw = String(patch.slug ?? "").trim();
                const base = raw ? slugifyTitle(raw) : slugifyTitle(existing.title?.trim() || "post");
                data.slug = await ensureUniqueBlogSlug(base, id);
            }
            else {
                data.slug = patch.slug;
            }
        }
        const row = await prisma_1.default.adminContent.update({
            where: { id },
            data,
        });
        return mapContentItem(row);
    }
    catch {
        return null;
    }
}
async function deleteContentItem(id) {
    try {
        await prisma_1.default.adminContent.delete({ where: { id } });
        return true;
    }
    catch {
        return false;
    }
}
function excerptFromBody(body, max = 200) {
    if (!body)
        return "";
    const t = body.replace(/\s+/g, " ").trim();
    return t.length <= max ? t : `${t.slice(0, max).trim()}…`;
}
function readBlogExtras(extras) {
    const ex = extras && typeof extras === "object" ? extras : {};
    return {
        coverImageUrl: typeof ex.coverImageUrl === "string" && ex.coverImageUrl.trim() ? ex.coverImageUrl.trim() : null,
        coverImagePublicId: typeof ex.coverImagePublicId === "string" && ex.coverImagePublicId.trim()
            ? ex.coverImagePublicId.trim()
            : null,
        author: typeof ex.author === "string" && ex.author.trim() ? ex.author.trim() : null,
        tag: typeof ex.tag === "string" && ex.tag.trim() ? ex.tag.trim() : null,
    };
}
/** Public listing: published blog posts only. */
async function listPublishedBlogs() {
    const rows = await prisma_1.default.adminContent.findMany({
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
async function getPublishedBlogBySlug(slug) {
    const s = slug.trim();
    if (!s)
        return null;
    const bySlug = await prisma_1.default.adminContent.findFirst({
        where: { type: "BLOG", published: true, slug: s },
    });
    const row = bySlug ??
        (await prisma_1.default.adminContent.findFirst({
            where: { type: "BLOG", published: true, id: s },
        }));
    if (!row)
        return null;
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
