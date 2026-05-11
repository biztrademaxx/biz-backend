"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExhibitorPromotionsAdmin = listExhibitorPromotionsAdmin;
exports.getExhibitorPromotionAdmin = getExhibitorPromotionAdmin;
exports.patchExhibitorPromotionAdmin = patchExhibitorPromotionAdmin;
exports.listOrganizerPromotionsAdmin = listOrganizerPromotionsAdmin;
exports.getOrganizerPromotionAdmin = getOrganizerPromotionAdmin;
exports.patchOrganizerPromotionAdmin = patchOrganizerPromotionAdmin;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const exhibitorForList = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    company: true,
    phone: true,
};
const organizerForList = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    organizationName: true,
};
/** Admin: promotions created by exhibitors */
async function listExhibitorPromotionsAdmin() {
    return prisma_1.default.promotion.findMany({
        where: { exhibitorId: { not: null } },
        include: {
            exhibitor: { select: exhibitorForList },
            event: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}
async function getExhibitorPromotionAdmin(id) {
    return prisma_1.default.promotion.findFirst({
        where: { id, exhibitorId: { not: null } },
        include: {
            exhibitor: { select: exhibitorForList },
            event: { select: { id: true, title: true, startDate: true, endDate: true } },
        },
    });
}
const EXHIBITOR_PATCH_STATUSES = ["APPROVED", "REJECTED", "ACTIVE", "COMPLETED", "EXPIRED"];
async function patchExhibitorPromotionAdmin(id, body) {
    const { status, rejectionReason } = body;
    if (!status || !EXHIBITOR_PATCH_STATUSES.includes(status)) {
        throw new Error("INVALID_STATUS");
    }
    if (status === "REJECTED" && !(rejectionReason && String(rejectionReason).trim())) {
        throw new Error("REJECTION_REASON_REQUIRED");
    }
    const existing = await prisma_1.default.promotion.findFirst({
        where: { id, exhibitorId: { not: null } },
    });
    if (!existing)
        return null;
    return prisma_1.default.promotion.update({
        where: { id },
        data: { status },
        include: {
            exhibitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    company: true,
                },
            },
            event: { select: { id: true, title: true } },
        },
    });
}
/** Admin: promotions created by organizers */
async function listOrganizerPromotionsAdmin() {
    const promotions = await prisma_1.default.promotion.findMany({
        where: { organizerId: { not: null } },
        include: {
            organizer: { select: organizerForList },
            event: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    return { promotions, total: promotions.length };
}
async function getOrganizerPromotionAdmin(id) {
    return prisma_1.default.promotion.findFirst({
        where: { id, organizerId: { not: null } },
        include: {
            organizer: { select: organizerForList },
            event: { select: { id: true, title: true } },
        },
    });
}
const ORGANIZER_PATCH_STATUSES = ["PENDING", "APPROVED", "REJECTED", "ACTIVE", "EXPIRED"];
async function patchOrganizerPromotionAdmin(id, body) {
    const { status, rejectionReason } = body;
    if (!status || !ORGANIZER_PATCH_STATUSES.includes(status)) {
        throw new Error("INVALID_STATUS");
    }
    if (status === "REJECTED" && !(rejectionReason && String(rejectionReason).trim())) {
        throw new Error("REJECTION_REASON_REQUIRED");
    }
    const existing = await prisma_1.default.promotion.findFirst({
        where: { id, organizerId: { not: null } },
    });
    if (!existing)
        return null;
    const updated = await prisma_1.default.promotion.update({
        where: { id },
        data: { status },
        include: {
            organizer: { select: organizerForList },
            exhibitor: { select: organizerForList },
            event: { select: { id: true, title: true } },
        },
    });
    return updated;
}
