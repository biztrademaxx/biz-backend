"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSubAdmins = listSubAdmins;
exports.getSubAdminById = getSubAdminById;
exports.createSubAdmin = createSubAdmin;
exports.updateSubAdmin = updateSubAdmin;
exports.deleteSubAdmin = deleteSubAdmin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
const role_definitions_service_1 = require("../role-definitions/role-definitions.service");
const SUBADMIN_SAFE_SORT = ["createdAt", "updatedAt", "email", "name"];
async function listSubAdmins(query, superAdminId) {
    const parsed = (0, admin_response_1.parseListQuery)(query);
    const sort = SUBADMIN_SAFE_SORT.includes(parsed.sort) ? parsed.sort : "createdAt";
    const { page, limit, search, skip, order } = parsed;
    const where = { createdById: superAdminId };
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
        ];
    }
    const [items, total, roleNames] = await Promise.all([
        prisma_1.default.subAdmin.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sort]: order },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                isActive: true,
                permissions: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                createdBy: { select: { id: true, name: true, email: true } },
            },
        }),
        prisma_1.default.subAdmin.count({ where }),
        (0, role_definitions_service_1.roleSlugToDisplayMap)(),
    ]);
    const data = items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        role: u.role,
        roleDisplayName: roleNames[u.role] ?? u.role.replace(/_/g, " "),
        isActive: u.isActive,
        permissions: u.permissions ?? [],
        lastLogin: u.lastLogin?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        createdBy: { id: u.createdBy.id, name: u.createdBy.name, email: u.createdBy.email },
    }));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getSubAdminById(id) {
    const sub = await prisma_1.default.subAdmin.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            permissions: true,
            lastLogin: true,
            createdAt: true,
            updatedAt: true,
            createdBy: { select: { id: true, name: true, email: true } },
        },
    });
    if (!sub)
        return null;
    const displayMap = await (0, role_definitions_service_1.roleSlugToDisplayMap)();
    return {
        id: sub.id,
        email: sub.email,
        name: sub.name,
        phone: sub.phone,
        role: sub.role,
        roleDisplayName: displayMap[sub.role] ?? sub.role.replace(/_/g, " "),
        isActive: sub.isActive,
        permissions: sub.permissions ?? [],
        lastLogin: sub.lastLogin?.toISOString() ?? null,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
        createdBy: { id: sub.createdBy.id, name: sub.createdBy.name, email: sub.createdBy.email },
    };
}
async function createSubAdmin(body, superAdminId) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email)
        throw new Error("Email is required");
    const existing = await prisma_1.default.subAdmin.findUnique({ where: { email } });
    if (existing)
        throw new Error("Sub-admin with this email already exists");
    const password = String(body.password ?? "").trim();
    if (!password || password.length < 6)
        throw new Error("Password must be at least 6 characters");
    const hashed = await bcryptjs_1.default.hash(password, 12);
    const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
    const roleRaw = String(body.role ?? "SUB_ADMIN").trim();
    const role = (0, role_definitions_service_1.normalizeRoleSlug)(roleRaw) || "SUB_ADMIN";
    await (0, role_definitions_service_1.assertActiveRoleSlug)(role);
    const sub = await prisma_1.default.subAdmin.create({
        data: {
            email,
            password: hashed,
            name: String(body.name ?? "").trim() || email.split("@")[0],
            phone: body.phone != null ? String(body.phone) : null,
            role,
            isActive: body.isActive !== false,
            permissions,
            createdById: superAdminId,
        },
    });
    return getSubAdminById(sub.id);
}
async function updateSubAdmin(id, body) {
    const existing = await prisma_1.default.subAdmin.findUnique({ where: { id } });
    if (!existing)
        return null;
    const data = {};
    if (body.name !== undefined)
        data.name = String(body.name).trim();
    if (body.email !== undefined)
        data.email = String(body.email).trim().toLowerCase();
    if (body.phone !== undefined)
        data.phone = body.phone ? String(body.phone) : null;
    if (body.isActive !== undefined)
        data.isActive = !!body.isActive;
    if (Array.isArray(body.permissions))
        data.permissions = body.permissions.map(String);
    if (body.role !== undefined) {
        const r = (0, role_definitions_service_1.normalizeRoleSlug)(String(body.role)) || "SUB_ADMIN";
        await (0, role_definitions_service_1.assertActiveRoleSlug)(r);
        data.role = r;
    }
    if (body.password !== undefined && String(body.password).trim().length >= 6) {
        data.password = await bcryptjs_1.default.hash(String(body.password).trim(), 12);
    }
    if (Object.keys(data).length === 0)
        return getSubAdminById(id);
    await prisma_1.default.subAdmin.update({ where: { id }, data });
    return getSubAdminById(id);
}
async function deleteSubAdmin(id) {
    const existing = await prisma_1.default.subAdmin.findUnique({ where: { id } });
    if (!existing)
        return null;
    await prisma_1.default.subAdmin.delete({ where: { id } });
    return { deleted: true };
}
