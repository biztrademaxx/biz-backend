"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listByEventId = listByEventId;
exports.getById = getById;
exports.create = create;
exports.remove = remove;
exports.update = update;
const prisma_1 = __importDefault(require("../../config/prisma"));
async function listByEventId(eventId) {
    return prisma_1.default.exhibitorManual.findMany({
        where: { eventId },
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}
async function getById(id) {
    return prisma_1.default.exhibitorManual.findUnique({
        where: { id },
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
    });
}
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(s) {
    return typeof s === "string" && UUID_REGEX.test(s.trim());
}
async function create(body) {
    const { eventId, uploadedById, fileName, fileUrl, fileSize, mimeType, description, version } = body;
    if (!eventId || !fileName || !fileUrl) {
        throw new Error("Missing required fields: eventId, fileName, fileUrl");
    }
    if (!uploadedById || uploadedById === "undefined" || !isValidUuid(uploadedById)) {
        throw new Error("Valid user ID (uploadedById) is required. Please sign in and try again.");
    }
    const event = await prisma_1.default.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event)
        throw new Error("Event not found");
    const user = await prisma_1.default.user.findUnique({ where: { id: uploadedById }, select: { id: true } });
    if (!user)
        throw new Error("User not found");
    return prisma_1.default.exhibitorManual.create({
        data: {
            eventId,
            uploadedById,
            fileName,
            fileUrl,
            fileSize: Number(fileSize),
            mimeType: mimeType ?? "application/pdf",
            description: description ?? null,
            version: version ?? "1.0",
        },
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
    });
}
async function remove(id) {
    const existing = await prisma_1.default.exhibitorManual.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new Error("Exhibitor manual not found");
    await prisma_1.default.exhibitorManual.delete({ where: { id } });
    return { deleted: true };
}
async function update(id, body) {
    const existing = await prisma_1.default.exhibitorManual.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new Error("Exhibitor manual not found");
    return prisma_1.default.exhibitorManual.update({
        where: { id },
        data: {
            ...(body.description !== undefined && { description: body.description }),
            ...(body.version !== undefined && { version: body.version }),
        },
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
    });
}
