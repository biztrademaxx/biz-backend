"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTickets = listTickets;
exports.updateTicketStatus = updateTicketStatus;
exports.addStaffReply = addStaffReply;
exports.createTicketForUser = createTicketForUser;
exports.listTicketsForUser = listTicketsForUser;
exports.addUserReply = addUserReply;
exports.getTicketForAdmin = getTicketForAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const admin_response_1 = require("../../../lib/admin-response");
const includeTicket = {
    user: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
        },
    },
    replies: {
        orderBy: { createdAt: "asc" },
        include: {
            authorUser: {
                select: { firstName: true, lastName: true, email: true },
            },
        },
    },
};
function serializeReply(r) {
    if (r.isStaffReply) {
        const name = r.staffAuthorName?.trim() || "Support";
        const parts = name.split(/\s+/);
        const firstName = parts[0] ?? "Support";
        const lastName = parts.slice(1).join(" ") || "Team";
        return {
            id: r.id,
            content: r.content,
            createdAt: r.createdAt.toISOString(),
            user: {
                firstName,
                lastName,
                email: "support@biztradefairs.com",
            },
        };
    }
    const u = r.authorUser;
    return {
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        user: {
            firstName: u?.firstName ?? "",
            lastName: u?.lastName ?? "",
            email: u?.email ?? "",
        },
    };
}
function serializeTicket(ticket) {
    return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        userRole: ticket.userRoleAtCreate,
        createdAt: ticket.createdAt.toISOString(),
        user: {
            firstName: ticket.user.firstName,
            lastName: ticket.user.lastName,
            email: ticket.user.email ?? "",
            role: ticket.user.role,
        },
        replies: ticket.replies.map(serializeReply),
    };
}
async function listTickets(query) {
    const { page, limit, search, skip } = (0, admin_response_1.parseListQuery)(query);
    const statusRaw = typeof query.status === "string" ? query.status : "";
    const userRoleRaw = typeof query.userRole === "string" ? query.userRole : "";
    const where = {};
    if (statusRaw && statusRaw !== "all") {
        where.status = statusRaw;
    }
    if (userRoleRaw && userRoleRaw !== "all") {
        where.userRoleAtCreate = userRoleRaw;
    }
    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ];
    }
    const [rows, total] = await Promise.all([
        prisma_1.default.supportTicket.findMany({
            where,
            include: includeTicket,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma_1.default.supportTicket.count({ where }),
    ]);
    const data = rows.map(serializeTicket);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
        data,
        pagination: { page, limit, total, totalPages },
    };
}
async function updateTicketStatus(ticketId, status) {
    const allowed = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    if (!allowed.includes(status)) {
        throw new Error("Invalid status");
    }
    await prisma_1.default.supportTicket.update({
        where: { id: ticketId },
        data: { status: status },
    });
}
async function addStaffReply(ticketId, content, staffName) {
    const ticket = await prisma_1.default.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket)
        throw new Error("Ticket not found");
    await prisma_1.default.supportTicketReply.create({
        data: {
            ticketId,
            content: content.trim(),
            isStaffReply: true,
            staffAuthorName: staffName.trim() || "Support",
        },
    });
    if (ticket.status === "OPEN") {
        await prisma_1.default.supportTicket.update({
            where: { id: ticketId },
            data: { status: "IN_PROGRESS" },
        });
    }
}
async function createTicketForUser(userId, body) {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error("User not found");
    const title = body.title?.trim();
    const description = body.description?.trim();
    if (!title || !description) {
        throw new Error("Title and description are required");
    }
    const priority = (body.priority?.toUpperCase() ?? "MEDIUM");
    const allowedP = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    const safePriority = allowedP.includes(priority) ? priority : "MEDIUM";
    const ticket = await prisma_1.default.supportTicket.create({
        data: {
            userId,
            title,
            description,
            category: body.category?.trim() || "general",
            priority: safePriority,
            userRoleAtCreate: user.role,
            status: "OPEN",
        },
        include: includeTicket,
    });
    return serializeTicket(ticket);
}
async function listTicketsForUser(userId) {
    const rows = await prisma_1.default.supportTicket.findMany({
        where: { userId },
        include: includeTicket,
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return rows.map(serializeTicket);
}
async function addUserReply(userId, ticketId, content) {
    const ticket = await prisma_1.default.supportTicket.findFirst({
        where: { id: ticketId, userId },
    });
    if (!ticket)
        throw new Error("Ticket not found");
    const text = content?.trim();
    if (!text)
        throw new Error("Message is required");
    await prisma_1.default.supportTicketReply.create({
        data: {
            ticketId,
            content: text,
            isStaffReply: false,
            authorUserId: userId,
        },
    });
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
        await prisma_1.default.supportTicket.update({
            where: { id: ticketId },
            data: { status: "OPEN" },
        });
    }
}
async function getTicketForAdmin(ticketId) {
    const ticket = await prisma_1.default.supportTicket.findUnique({
        where: { id: ticketId },
        include: includeTicket,
    });
    if (!ticket)
        return null;
    return serializeTicket(ticket);
}
