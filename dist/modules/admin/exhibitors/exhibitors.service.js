"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExhibitors = listExhibitors;
exports.getExhibitorById = getExhibitorById;
exports.createExhibitor = createExhibitor;
exports.updateExhibitor = updateExhibitor;
exports.deleteExhibitor = deleteExhibitor;
exports.getExhibitorStats = getExhibitorStats;
exports.listExhibitorFeedbackForAdmin = listExhibitorFeedbackForAdmin;
exports.listExhibitorAppointmentsForAdmin = listExhibitorAppointmentsForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
const ROLE = "EXHIBITOR";
async function listExhibitors(query) {
    const { page, limit, search, skip, sort, order } = (0, admin_response_1.parseListQuery)(query);
    const where = { role: ROLE };
    if (search) {
        where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
        ];
    }
    const [items, total] = await Promise.all([
        prisma_1.default.user.findMany({
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
        prisma_1.default.user.count({ where }),
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
async function getExhibitorById(id) {
    const user = await prisma_1.default.user.findFirst({
        where: { id, role: ROLE },
    });
    if (!user)
        return null;
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
async function createExhibitor(body) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email)
        throw new Error("Email is required");
    const existing = await prisma_1.default.user.findFirst({ where: { email, role: ROLE } });
    if (existing)
        throw new Error("Exhibitor with this email already exists");
    const user = await prisma_1.default.user.create({
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
async function updateExhibitor(id, body) {
    const existing = await prisma_1.default.user.findFirst({ where: { id, role: ROLE } });
    if (!existing)
        return null;
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
    const data = {};
    for (const k of allowed) {
        if (body[k] !== undefined)
            data[k] = body[k];
    }
    if (body.email !== undefined)
        data.email = String(body.email).trim().toLowerCase();
    await prisma_1.default.user.update({ where: { id }, data: data });
    return getExhibitorById(id);
}
async function deleteExhibitor(id) {
    const existing = await prisma_1.default.user.findFirst({ where: { id, role: ROLE } });
    if (!existing)
        return null;
    await prisma_1.default.user.delete({ where: { id } });
    return { deleted: true };
}
async function getExhibitorStats() {
    const [total, active] = await Promise.all([
        prisma_1.default.user.count({ where: { role: ROLE } }),
        prisma_1.default.user.count({ where: { role: ROLE, isActive: true } }),
    ]);
    return { total, active };
}
async function listExhibitorFeedbackForAdmin() {
    const reviews = await prisma_1.default.review.findMany({
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
    const exhibitorIds = [...new Set(reviews.map((r) => r.exhibitorId).filter(Boolean))];
    const exhibitors = exhibitorIds.length > 0
        ? await prisma_1.default.user.findMany({
            where: { id: { in: exhibitorIds } },
            select: { id: true, firstName: true, lastName: true, email: true, company: true },
        })
        : [];
    const exhibitorMap = new Map(exhibitors.map((e) => [e.id, e]));
    const name = (first, last, fallback) => `${first ?? ""} ${last ?? ""}`.trim() || fallback;
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
async function listExhibitorAppointmentsForAdmin() {
    const appointments = await prisma_1.default.appointment.findMany({
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
    const name = (first, last) => `${first ?? ""} ${last ?? ""}`.trim() || "—";
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
            status: apt.status,
            meetingType: apt.meetingType ?? "IN_PERSON",
            location: apt.location ?? undefined,
            notes: apt.notes ?? undefined,
            cancelReason: apt.cancellationReason ?? undefined,
            cancelledAt: apt.cancelledAt?.toISOString(),
            createdAt: apt.createdAt.toISOString(),
        };
    });
}
