"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.getUserById = getUserById;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
async function listUsers(query) {
    const { page, limit, search, skip, sort, order } = (0, admin_response_1.parseListQuery)(query);
    const where = {};
    const roleFilter = typeof query.role === "string" ? query.role : undefined;
    if (roleFilter) {
        where.role = roleFilter;
    }
    if (search) {
        where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
        ];
    }
    const select = {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        company: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
    };
    if (roleFilter === "ORGANIZER") {
        select.organizationName = true;
    }
    if (roleFilter === "VENUE_MANAGER") {
        select.venueName = true;
        select.venueAddress = true;
        select.venueCity = true;
        select.venueState = true;
        select.venueCountry = true;
        select.maxCapacity = true;
        select.amenities = true;
    }
    const [items, total] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sort]: order },
            select,
        }),
        prisma_1.default.user.count({ where }),
    ]);
    const data = items.map((u) => ({
        id: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        company: u.company,
        organizationName: u.organizationName ?? undefined,
        venueName: u.venueName ?? undefined,
        venueAddress: u.venueAddress ?? undefined,
        venueCity: u.venueCity ?? undefined,
        venueState: u.venueState ?? undefined,
        venueCountry: u.venueCountry ?? undefined,
        maxCapacity: u.maxCapacity ?? undefined,
        amenities: Array.isArray(u.amenities) ? u.amenities : [],
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
    }));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function getUserById(id) {
    const user = await prisma_1.default.user.findUnique({
        where: { id },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            company: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!user)
        return null;
    return {
        ...user,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}
