"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDueAccountDeactivations = processDueAccountDeactivations;
exports.listPendingDeactivationRequests = listPendingDeactivationRequests;
exports.listAllDeactivationRequestsForAdmin = listAllDeactivationRequestsForAdmin;
exports.approveDeactivationRequest = approveDeactivationRequest;
exports.rejectDeactivationRequest = rejectDeactivationRequest;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const client_1 = require("@prisma/client");
const GRACE_MS = 30 * 24 * 60 * 60 * 1000;
/** Apply approved deactivations whose effective date has passed. */
async function processDueAccountDeactivations() {
    const now = new Date();
    const due = await prisma_1.default.accountDeactivationRequest.findMany({
        where: {
            status: client_1.AccountDeactivationStatus.APPROVED,
            deactivateEffectiveAt: { lte: now },
        },
        select: { id: true, userId: true },
    });
    let n = 0;
    for (const row of due) {
        try {
            await prisma_1.default.$transaction([
                prisma_1.default.user.update({
                    where: { id: row.userId },
                    data: { isActive: false },
                }),
                prisma_1.default.accountDeactivationRequest.update({
                    where: { id: row.id },
                    data: { status: client_1.AccountDeactivationStatus.COMPLETED },
                }),
            ]);
            n += 1;
        }
        catch {
            // eslint-disable-next-line no-console
            console.error("[deactivation] Failed to complete request", row.id);
        }
    }
    return n;
}
async function listPendingDeactivationRequests() {
    return prisma_1.default.accountDeactivationRequest.findMany({
        where: { status: client_1.AccountDeactivationStatus.PENDING },
        orderBy: { requestedAt: "asc" },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    phone: true,
                    createdAt: true,
                },
            },
        },
    });
}
async function listAllDeactivationRequestsForAdmin(status) {
    const where = status && Object.values(client_1.AccountDeactivationStatus).includes(status)
        ? { status: status }
        : {};
    return prisma_1.default.accountDeactivationRequest.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: 200,
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                },
            },
        },
    });
}
async function approveDeactivationRequest(requestId, adminId, adminType) {
    const row = await prisma_1.default.accountDeactivationRequest.findUnique({
        where: { id: requestId },
    });
    if (!row) {
        throw new Error("Request not found");
    }
    if (row.status !== client_1.AccountDeactivationStatus.PENDING) {
        throw new Error("Request is not pending");
    }
    const reviewedAt = new Date();
    const deactivateEffectiveAt = new Date(reviewedAt.getTime() + GRACE_MS);
    await prisma_1.default.accountDeactivationRequest.update({
        where: { id: requestId },
        data: {
            status: client_1.AccountDeactivationStatus.APPROVED,
            reviewedAt,
            reviewedByAdminId: adminId,
            reviewedByAdminType: adminType,
            deactivateEffectiveAt,
        },
    });
    return { effectiveAt: deactivateEffectiveAt };
}
async function rejectDeactivationRequest(requestId, adminId, adminType, rejectReason) {
    const row = await prisma_1.default.accountDeactivationRequest.findUnique({
        where: { id: requestId },
    });
    if (!row) {
        throw new Error("Request not found");
    }
    if (row.status !== client_1.AccountDeactivationStatus.PENDING) {
        throw new Error("Request is not pending");
    }
    await prisma_1.default.accountDeactivationRequest.update({
        where: { id: requestId },
        data: {
            status: client_1.AccountDeactivationStatus.REJECTED,
            reviewedAt: new Date(),
            reviewedByAdminId: adminId,
            reviewedByAdminType: adminType,
            rejectReason: rejectReason?.trim() || null,
        },
    });
}
