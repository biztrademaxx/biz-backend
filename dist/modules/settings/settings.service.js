"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeactivationSummaryForUser = getDeactivationSummaryForUser;
exports.getSettingsForUser = getSettingsForUser;
exports.updateSettingsForUser = updateSettingsForUser;
exports.sendEmailChangeOtp = sendEmailChangeOtp;
exports.verifyEmailChangeOtp = verifyEmailChangeOtp;
exports.requestAccountDeactivation = requestAccountDeactivation;
exports.cancelPendingDeactivationRequest = cancelPendingDeactivationRequest;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../config/prisma"));
const email_service_1 = require("../../services/email.service");
function mapUserToSettings(u, deactivation) {
    return {
        profileVisibility: u.profileVisibility || "public",
        phoneNumber: u.phone ?? "",
        email: u.email ?? "",
        introduceMe: u.introduceMe,
        emailNotifications: u.emailNotifications,
        eventReminders: u.eventReminders,
        newMessages: u.newMessages,
        connectionRequests: u.connectionRequests,
        emailVerified: u.emailVerified,
        phoneVerified: u.phoneVerified,
        role: u.role,
        deactivation,
    };
}
async function getDeactivationSummaryForUser(userId, userIsActive) {
    const latest = await prisma_1.default.accountDeactivationRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
    });
    if (!latest || latest.status === client_1.AccountDeactivationStatus.CANCELLED) {
        return { status: "NONE" };
    }
    if (latest.status === client_1.AccountDeactivationStatus.PENDING) {
        return {
            status: "PENDING",
            requestId: latest.id,
            requestedAt: latest.requestedAt.toISOString(),
        };
    }
    if (latest.status === client_1.AccountDeactivationStatus.APPROVED) {
        const eff = latest.deactivateEffectiveAt;
        if (eff && eff.getTime() > Date.now()) {
            return {
                status: "APPROVED",
                requestId: latest.id,
                requestedAt: latest.requestedAt.toISOString(),
                reviewedAt: latest.reviewedAt?.toISOString(),
                deactivateEffectiveAt: eff.toISOString(),
            };
        }
        if (!userIsActive) {
            return {
                status: "COMPLETED",
                requestedAt: latest.requestedAt.toISOString(),
                reviewedAt: latest.reviewedAt?.toISOString(),
                deactivateEffectiveAt: eff?.toISOString(),
            };
        }
        return {
            status: "APPROVED",
            requestId: latest.id,
            requestedAt: latest.requestedAt.toISOString(),
            reviewedAt: latest.reviewedAt?.toISOString(),
            deactivateEffectiveAt: eff?.toISOString(),
        };
    }
    if (latest.status === client_1.AccountDeactivationStatus.REJECTED) {
        return {
            status: "REJECTED",
            requestId: latest.id,
            requestedAt: latest.requestedAt.toISOString(),
            reviewedAt: latest.reviewedAt?.toISOString() ?? undefined,
            rejectReason: latest.rejectReason,
        };
    }
    if (latest.status === client_1.AccountDeactivationStatus.COMPLETED) {
        return {
            status: "COMPLETED",
            requestedAt: latest.requestedAt.toISOString(),
            reviewedAt: latest.reviewedAt?.toISOString(),
        };
    }
    return { status: "NONE" };
}
async function getSettingsForUser(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: {
            profileVisibility: true,
            phone: true,
            email: true,
            introduceMe: true,
            emailNotifications: true,
            eventReminders: true,
            newMessages: true,
            connectionRequests: true,
            emailVerified: true,
            phoneVerified: true,
            role: true,
            isActive: true,
        },
    });
    if (!user)
        return null;
    const { isActive, ...rest } = user;
    const deactivation = await getDeactivationSummaryForUser(userId, isActive);
    return mapUserToSettings(rest, deactivation);
}
async function updateSettingsForUser(userId, body) {
    const data = {};
    if (body.profileVisibility !== undefined) {
        const v = String(body.profileVisibility).toLowerCase();
        if (v === "public" || v === "private") {
            data.profileVisibility = v;
        }
    }
    if (body.phoneNumber !== undefined) {
        data.phone = String(body.phoneNumber).trim() || null;
    }
    if (body.email !== undefined) {
        const em = String(body.email).trim().toLowerCase();
        if (em) {
            const taken = await prisma_1.default.user.findFirst({
                where: { email: em, id: { not: userId } },
            });
            if (taken) {
                throw new Error("This email is already registered with another account");
            }
            data.email = em;
        }
    }
    if (body.introduceMe !== undefined)
        data.introduceMe = Boolean(body.introduceMe);
    if (body.emailNotifications !== undefined)
        data.emailNotifications = Boolean(body.emailNotifications);
    if (body.eventReminders !== undefined)
        data.eventReminders = Boolean(body.eventReminders);
    if (body.newMessages !== undefined)
        data.newMessages = Boolean(body.newMessages);
    if (body.connectionRequests !== undefined)
        data.connectionRequests = Boolean(body.connectionRequests);
    if (Object.keys(data).length === 0) {
        return getSettingsForUser(userId);
    }
    const user = await prisma_1.default.user.update({
        where: { id: userId },
        data: data,
        select: {
            profileVisibility: true,
            phone: true,
            email: true,
            introduceMe: true,
            emailNotifications: true,
            eventReminders: true,
            newMessages: true,
            connectionRequests: true,
            emailVerified: true,
            phoneVerified: true,
            role: true,
            isActive: true,
        },
    });
    const { isActive, ...rest } = user;
    const deactivation = await getDeactivationSummaryForUser(userId, isActive);
    return mapUserToSettings(rest, deactivation);
}
async function sendEmailChangeOtp(userId, rawEmail) {
    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
    }
    const other = await prisma_1.default.user.findFirst({
        where: { email, id: { not: userId } },
    });
    if (other) {
        throw new Error("This email is already registered with another account");
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma_1.default.otp.deleteMany({ where: { userId } });
    await prisma_1.default.otp.create({
        data: {
            email,
            otp,
            expiresAt,
            userId,
        },
    });
    await (0, email_service_1.sendVerificationEmail)(email, otp);
}
async function verifyEmailChangeOtp(userId, rawEmail, code) {
    const email = rawEmail.trim().toLowerCase();
    if (!/^\d{6}$/.test(code)) {
        throw new Error("Verification code must be 6 digits");
    }
    const other = await prisma_1.default.user.findFirst({
        where: { email, id: { not: userId } },
    });
    if (other) {
        throw new Error("This email is already registered with another account");
    }
    const row = await prisma_1.default.otp.findFirst({
        where: { userId, email },
        orderBy: { createdAt: "desc" },
    });
    if (!row) {
        throw new Error("No verification code found. Please request a new one.");
    }
    if (row.expiresAt < new Date()) {
        throw new Error("Verification code expired. Please request a new one.");
    }
    if (row.otp !== code) {
        throw new Error("Invalid verification code");
    }
    await prisma_1.default.otp.deleteMany({ where: { userId, email } });
    const user = await prisma_1.default.user.update({
        where: { id: userId },
        data: { email, emailVerified: true },
        select: {
            profileVisibility: true,
            phone: true,
            email: true,
            introduceMe: true,
            emailNotifications: true,
            eventReminders: true,
            newMessages: true,
            connectionRequests: true,
            emailVerified: true,
            phoneVerified: true,
            role: true,
            isActive: true,
        },
    });
    const { isActive, ...rest } = user;
    const deactivation = await getDeactivationSummaryForUser(userId, isActive);
    return mapUserToSettings(rest, deactivation);
}
/** User requests account closure — pending admin approval, then 30-day grace after approval. */
async function requestAccountDeactivation(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
    });
    if (!user?.isActive) {
        throw new Error("Account is already inactive");
    }
    const pending = await prisma_1.default.accountDeactivationRequest.findFirst({
        where: { userId, status: client_1.AccountDeactivationStatus.PENDING },
    });
    if (pending) {
        throw new Error("You already have a pending deactivation request");
    }
    const approvedGrace = await prisma_1.default.accountDeactivationRequest.findFirst({
        where: {
            userId,
            status: client_1.AccountDeactivationStatus.APPROVED,
            deactivateEffectiveAt: { gt: new Date() },
        },
    });
    if (approvedGrace) {
        throw new Error("A deactivation is already scheduled for your account");
    }
    const row = await prisma_1.default.accountDeactivationRequest.create({
        data: {
            userId,
            status: client_1.AccountDeactivationStatus.PENDING,
        },
    });
    return { requestId: row.id };
}
async function cancelPendingDeactivationRequest(userId) {
    const pending = await prisma_1.default.accountDeactivationRequest.findFirst({
        where: { userId, status: client_1.AccountDeactivationStatus.PENDING },
    });
    if (!pending) {
        throw new Error("No pending deactivation request to cancel");
    }
    await prisma_1.default.accountDeactivationRequest.update({
        where: { id: pending.id },
        data: { status: client_1.AccountDeactivationStatus.CANCELLED },
    });
}
