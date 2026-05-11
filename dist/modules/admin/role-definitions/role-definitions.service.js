"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRoleSlug = normalizeRoleSlug;
exports.listRoleDefinitions = listRoleDefinitions;
exports.getRoleDefinitionById = getRoleDefinitionById;
exports.createRoleDefinition = createRoleDefinition;
exports.updateRoleDefinition = updateRoleDefinition;
exports.deleteRoleDefinition = deleteRoleDefinition;
exports.roleSlugToDisplayMap = roleSlugToDisplayMap;
exports.assertActiveRoleSlug = assertActiveRoleSlug;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
function normalizeRoleSlug(input) {
    return input
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");
}
function parseSortOrder(raw, fallback = 100) {
    const n = Number(raw);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(2147483647, Math.max(-2147483648, Math.trunc(n)));
}
async function seedBuiltInRolesIfEmpty() {
    const n = await prisma_1.default.adminRoleDefinition.count();
    if (n > 0)
        return;
    await prisma_1.default.adminRoleDefinition.createMany({
        data: [
            {
                slug: "SUB_ADMIN",
                name: "Sub Admin",
                description: "Standard sub-administrator; permissions assigned per user.",
                defaultPermissions: [],
                isSystem: true,
                sortOrder: 0,
            },
            {
                slug: "MODERATOR",
                name: "Moderator",
                description: "Event and directory moderation.",
                defaultPermissions: ["events-all", "events-approvals", "organizers-all", "exhibitors-all", "speakers-all"],
                isSystem: true,
                sortOrder: 1,
            },
            {
                slug: "SUPPORT",
                name: "Support Staff",
                description: "Support tickets and visitor tools.",
                defaultPermissions: [
                    "support-tickets",
                    "support-contacts",
                    "support-notes",
                    "visitors-events",
                    "visitors-connections",
                ],
                isSystem: true,
                sortOrder: 2,
            },
        ],
    });
}
async function listRoleDefinitions(query) {
    await seedBuiltInRolesIfEmpty();
    const { page, limit, skip, search, order } = (0, admin_response_1.parseListQuery)(query);
    const activeOnly = query.active === "true" || query.active === true;
    const where = {};
    if (activeOnly)
        where.isActive = true;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
        ];
    }
    const [items, total] = await Promise.all([
        prisma_1.default.adminRoleDefinition.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma_1.default.adminRoleDefinition.count({ where }),
    ]);
    const data = items.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        defaultPermissions: r.defaultPermissions ?? [],
        isActive: r.isActive,
        isSystem: r.isSystem,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getRoleDefinitionById(id) {
    const r = await prisma_1.default.adminRoleDefinition.findUnique({ where: { id } });
    if (!r)
        return null;
    return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        defaultPermissions: r.defaultPermissions ?? [],
        isActive: r.isActive,
        isSystem: r.isSystem,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    };
}
async function createRoleDefinition(body) {
    await seedBuiltInRolesIfEmpty();
    const name = String(body.name ?? "").trim();
    if (!name)
        throw new Error("Name is required");
    let slug = normalizeRoleSlug(String(body.slug ?? ""));
    if (!slug)
        slug = normalizeRoleSlug(name);
    if (!slug)
        throw new Error("Could not derive slug from name");
    const existing = await prisma_1.default.adminRoleDefinition.findUnique({ where: { slug } });
    if (existing)
        throw new Error("A role with this slug already exists");
    const defaultPermissions = Array.isArray(body.defaultPermissions)
        ? body.defaultPermissions.map(String)
        : [];
    const r = await prisma_1.default.adminRoleDefinition.create({
        data: {
            slug,
            name,
            description: body.description != null ? String(body.description).trim() || null : null,
            defaultPermissions,
            isActive: body.isActive !== false,
            isSystem: false,
            sortOrder: Number(body.sortOrder ?? 100),
        },
    });
    return getRoleDefinitionById(r.id);
}
async function updateRoleDefinition(id, body) {
    const existing = await prisma_1.default.adminRoleDefinition.findUnique({ where: { id } });
    if (!existing)
        return null;
    if (existing.isSystem && body.slug !== undefined) {
        throw new Error("Cannot change slug of a system role");
    }
    const data = {};
    if (body.name !== undefined)
        data.name = String(body.name).trim();
    if (body.description !== undefined)
        data.description = body.description ? String(body.description).trim() : null;
    if (Array.isArray(body.defaultPermissions))
        data.defaultPermissions = body.defaultPermissions.map(String);
    if (body.isActive !== undefined)
        data.isActive = !!body.isActive;
    if (body.sortOrder !== undefined)
        data.sortOrder = parseSortOrder(body.sortOrder, 0);
    if (!existing.isSystem && body.slug !== undefined) {
        const slug = normalizeRoleSlug(String(body.slug));
        if (slug && slug !== existing.slug) {
            const clash = await prisma_1.default.adminRoleDefinition.findUnique({ where: { slug } });
            if (clash)
                throw new Error("Slug already in use");
            data.slug = slug;
        }
    }
    await prisma_1.default.adminRoleDefinition.update({ where: { id }, data });
    return getRoleDefinitionById(id);
}
async function deleteRoleDefinition(id) {
    const existing = await prisma_1.default.adminRoleDefinition.findUnique({ where: { id } });
    if (!existing)
        return null;
    if (existing.isSystem)
        throw new Error("Cannot delete a system role");
    const inUse = await prisma_1.default.subAdmin.count({ where: { role: existing.slug } });
    if (inUse > 0)
        throw new Error(`Cannot delete: ${inUse} sub-admin(s) use this role`);
    await prisma_1.default.adminRoleDefinition.delete({ where: { id } });
    return { deleted: true };
}
/** Resolve display names for sub-admin list (batch). */
async function roleSlugToDisplayMap() {
    await seedBuiltInRolesIfEmpty();
    const rows = await prisma_1.default.adminRoleDefinition.findMany({
        select: { slug: true, name: true },
    });
    return Object.fromEntries(rows.map((r) => [r.slug, r.name]));
}
async function assertActiveRoleSlug(slug) {
    await seedBuiltInRolesIfEmpty();
    const s = normalizeRoleSlug(slug);
    if (!s)
        throw new Error("Role is required");
    const def = await prisma_1.default.adminRoleDefinition.findFirst({
        where: { slug: s, isActive: true },
    });
    if (!def)
        throw new Error(`Unknown or inactive role: ${s}`);
}
