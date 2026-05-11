"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_service_1 = require("../services/auth.service");
const email_service_1 = require("../services/email.service");
const router = (0, express_1.Router)();
const BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET;
/** Signup / registration OTP rows — isolated from admin password-reset OTPs. */
const OTP_PURPOSE_REGISTRATION = "registration";
const OTP_PURPOSE_ADMIN_PASSWORD_RESET = "admin_password_reset";
const ROLE_DISPLAY = {
    ATTENDEE: "Visitor",
    ORGANIZER: "Organizer",
    EXHIBITOR: "Exhibitor",
    SPEAKER: "Speaker",
    VENUE_MANAGER: "Venue Manager",
    ADMIN: "Admin",
};
function validatePortalPassword(password) {
    if (password.length < 8)
        return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password))
        return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(password))
        return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(password))
        return "Password must contain at least one number";
    return null;
}
// POST /api/auth/login – email/password → JWT (user, super-admin, sub-admin)
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const result = await auth_service_1.AuthService.authenticateWithCredentials(email, password);
        if (!result) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        return res.json({
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Login error (backend):", err);
        return res.status(500).json({ message: "Login failed" });
    }
});
// POST /api/auth/refresh – refreshToken → new access + refresh tokens
router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: "refreshToken is required" });
        }
        const tokens = await auth_service_1.AuthService.refreshTokens(refreshToken);
        return res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Refresh token error (backend):", err);
        return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
});
// POST /api/auth/oauth-sync — server-to-server from Next.js NextAuth (header secret).
// Persists Google/LinkedIn users to PostgreSQL and returns the same JWT shape as /login.
router.post("/oauth-sync", async (req, res) => {
    try {
        const expected = process.env.OAUTH_SYNC_SECRET;
        if (!expected) {
            return res.status(503).json({
                message: "OAuth sync is not configured (OAUTH_SYNC_SECRET)",
            });
        }
        const headerSecret = req.headers["x-oauth-sync-secret"];
        if (headerSecret !== expected) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const body = req.body;
        const email = body.email?.trim();
        if (!email) {
            return res.status(400).json({ message: "email is required" });
        }
        const result = await auth_service_1.AuthService.syncOAuthPortalUser({
            email,
            name: body.name,
            image: body.image,
        });
        return res.json({
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("OAuth sync error (backend):", err);
        const msg = err instanceof Error ? err.message : "OAuth sync failed";
        if (msg === "Account is deactivated") {
            return res.status(403).json({ message: msg });
        }
        return res.status(500).json({ message: msg });
    }
});
// POST /api/auth/send-otp
router.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const normalizedEmail = email.trim().toLowerCase();
        // 1. Check if user already exists (same behavior as Next.js route)
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            return res.status(409).json({
                alreadyRegistered: true,
                message: "Email already registered. Please login.",
            });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await prisma_1.default.otp.deleteMany({
            where: { email: normalizedEmail, purpose: OTP_PURPOSE_REGISTRATION },
        });
        await prisma_1.default.otp.create({
            data: { email: normalizedEmail, otp, expiresAt, purpose: OTP_PURPOSE_REGISTRATION },
        });
        // Send OTP email via centralized email service
        await (0, email_service_1.sendOtpEmail)(normalizedEmail, otp);
        return res.json({ message: "OTP sent successfully" });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Send OTP error (backend):", err);
        const msg = err instanceof Error ? err.message : String(err);
        const prismaCode = typeof err === "object" && err && "code" in err ? String(err.code) : "";
        let code;
        if (msg.includes("Resend network error")) {
            code = "EMAIL_NETWORK";
        }
        else if (msg.includes("SendGrid network error")) {
            code = "EMAIL_NETWORK";
        }
        else if (msg.includes("Resend error") || msg.includes("Resend")) {
            code = "EMAIL_VENDOR";
        }
        else if (msg.includes("SendGrid error") || msg.includes("SendGrid")) {
            code = "EMAIL_VENDOR";
        }
        else if (msg.includes("credentials are not configured") || msg.includes("sender email")) {
            code = "EMAIL_NOT_CONFIGURED";
        }
        else if (prismaCode.startsWith("P") || msg.includes("Prisma")) {
            code = "DATABASE";
        }
        const exposeDetail = process.env.NODE_ENV === "development" || process.env.EXPOSE_EMAIL_ERRORS === "true";
        return res.status(500).json({
            message: "Failed to send OTP",
            ...(code ? { code } : {}),
            ...(exposeDetail ? { detail: msg.slice(0, 500) } : {}),
        });
    }
});
// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: "Email & OTP are required" });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const record = await prisma_1.default.otp.findFirst({
            where: { email: normalizedEmail, purpose: OTP_PURPOSE_REGISTRATION },
            orderBy: { createdAt: "desc" },
        });
        if (!record) {
            return res.status(400).json({ message: "OTP not found" });
        }
        if (record.expiresAt < new Date()) {
            return res.status(400).json({ message: "OTP expired" });
        }
        if (record.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }
        await prisma_1.default.otp.deleteMany({
            where: { email: normalizedEmail, purpose: OTP_PURPOSE_REGISTRATION },
        });
        return res.json({ message: "OTP verified successfully" });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Verify OTP error (backend):", err);
        return res.status(500).json({ message: "Failed to verify OTP" });
    }
});
// POST /api/auth/register – user registration (shared with Next.js route)
router.post("/register", async (req, res) => {
    try {
        const { fullName, email, password, phone, companyName, designation, website, userType, selectedPlan, } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({
                error: "fullName, email and password are required",
            });
        }
        const normalizedEmail = email.trim().toLowerCase();
        // Name parsing (same logic as Next.js route)
        const nameParts = fullName.trim().split(" ");
        let firstName = "";
        let lastName = "";
        if (nameParts.length === 1) {
            firstName = nameParts[0];
            lastName = "User";
        }
        else if (nameParts.length === 2) {
            firstName = nameParts[0];
            lastName = nameParts[1];
        }
        else {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(" ");
        }
        const roleMapping = {
            visitor: "ATTENDEE",
            exhibitor: "EXHIBITOR",
            organiser: "ORGANIZER",
            speaker: "SPEAKER",
            venue: "VENUE_MANAGER",
        };
        const role = roleMapping[userType ?? ""] || "ATTENDEE";
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            return res.status(400).json({
                error: "User with this email already exists",
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: {
                firstName,
                lastName,
                email: normalizedEmail,
                password: hashedPassword,
                phone: phone || undefined,
                role: role,
                company: companyName || undefined,
                jobTitle: designation || undefined,
                website: website || undefined,
            },
        });
        if (userType === "organiser" && selectedPlan) {
            // Placeholder: could persist organizer plan selection here
            // eslint-disable-next-line no-console
            console.log(`User ${user.id} selected plan: ${selectedPlan}`);
        }
        return res.status(201).json({
            success: true,
            message: "Account created successfully! Welcome to our platform.",
            user: {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Registration error (backend):", error);
        if (error?.code === "P2002") {
            return res.status(400).json({
                error: "User with this email already exists",
            });
        }
        return res.status(500).json({
            error: "Registration failed. Please try again.",
            details: error?.message,
        });
    }
});
// POST /api/auth/forgot-password — Express backend only (no Next.js route).
// Sub-admin & super-admin: 6-digit OTP to their login email.
// App users: reset link to the same email they entered.
router.post("/forgot-password", async (req, res) => {
    try {
        const emailRaw = req.body?.email;
        if (!emailRaw || typeof emailRaw !== "string") {
            return res.status(400).json({
                success: false,
                error: "Email is required",
                details: "Invalid email format.",
            });
        }
        const emailLower = emailRaw.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
            return res.status(400).json({
                success: false,
                error: "Validation failed",
                details: "Invalid email address",
            });
        }
        const subAdmin = await prisma_1.default.subAdmin.findFirst({
            where: { email: emailLower, isActive: true },
        });
        const superAdmin = await prisma_1.default.superAdmin.findFirst({
            where: { email: emailLower, isActive: true },
        });
        if (subAdmin || superAdmin) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await prisma_1.default.otp.deleteMany({
                where: { email: emailLower, purpose: OTP_PURPOSE_ADMIN_PASSWORD_RESET },
            });
            await prisma_1.default.otp.create({
                data: {
                    email: emailLower,
                    otp,
                    expiresAt,
                    purpose: OTP_PURPOSE_ADMIN_PASSWORD_RESET,
                },
            });
            try {
                if (subAdmin) {
                    await (0, email_service_1.sendAdminPasswordResetOtpEmail)({
                        toEmail: emailLower,
                        otp,
                        name: subAdmin.name,
                        adminKind: "Sub Admin",
                    });
                }
                else if (superAdmin) {
                    await (0, email_service_1.sendAdminPasswordResetOtpEmail)({
                        toEmail: emailLower,
                        otp,
                        name: superAdmin.name,
                        adminKind: "Super Admin",
                    });
                }
            }
            catch (emailErr) {
                await prisma_1.default.otp.deleteMany({
                    where: { email: emailLower, purpose: OTP_PURPOSE_ADMIN_PASSWORD_RESET },
                });
                // eslint-disable-next-line no-console
                console.error("Admin forgot-password email error:", emailErr);
                return res.status(500).json({
                    success: false,
                    error: "Failed to send reset email. Please try again later.",
                });
            }
            return res.json({
                success: true,
                resetMode: "otp",
                message: "A 6-digit code was sent to your email. Use the admin reset page to set a new password.",
            });
        }
        const user = await prisma_1.default.user.findFirst({
            where: { email: emailLower, isActive: true },
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "No account found with this email address. Please check your email or sign up.",
            });
        }
        // NOTE:
        // Some legacy signup flows allow login but did not persist emailVerified=true
        // after OTP verification. Do not block password reset for those valid users.
        // We still keep the same secure reset-token flow and send the link only to
        // the account email itself.
        const maxResetAttempts = 5;
        if ((user.passwordResetAttempts ?? 0) >= maxResetAttempts) {
            return res.status(429).json({
                success: false,
                error: "Too many password reset attempts. Please try again later or contact support.",
            });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                resetToken,
                resetTokenExpiry,
                loginAttempts: 0,
                passwordResetAttempts: { increment: 1 },
            },
        });
        const headerOrigin = (typeof req.headers.origin === "string" ? req.headers.origin : undefined) ||
            (typeof req.headers.referer === "string" ? req.headers.referer : undefined);
        let parsedOrigin;
        if (headerOrigin) {
            try {
                parsedOrigin = new URL(headerOrigin).origin;
            }
            catch {
                parsedOrigin = undefined;
            }
        }
        const base = (0, email_service_1.resolveFrontendBase)(parsedOrigin).replace(/\/$/, "");
        const encodedEmail = encodeURIComponent(emailLower);
        const resetUrl = `${base}/reset-password?token=${resetToken}&email=${encodedEmail}`;
        const userRole = ROLE_DISPLAY[user.role] || user.role;
        const firstName = user.firstName || "there";
        try {
            await (0, email_service_1.sendPasswordResetLinkEmail)({
                toEmail: emailLower,
                resetUrl,
                firstName,
                roleLabel: userRole,
            });
        }
        catch (emailErr) {
            await prisma_1.default.user.update({
                where: { id: user.id },
                data: { resetToken: null, resetTokenExpiry: null },
            });
            // eslint-disable-next-line no-console
            console.error("User forgot-password email error:", emailErr);
            return res.status(500).json({
                success: false,
                error: "Failed to send reset email. Please try again later.",
            });
        }
        return res.json({
            success: true,
            resetMode: "link",
            message: "Password reset link has been sent to your email.",
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Forgot password error:", err);
        return res.status(500).json({
            success: false,
            error: "Failed to process password reset request. Please try again.",
        });
    }
});
// POST /api/auth/verify-reset-token — portal users (link flow); always 200 + valid flag for client UX.
router.post("/verify-reset-token", async (req, res) => {
    try {
        const { token, email } = (req.body || {});
        if (!token || !email) {
            return res.status(200).json({
                success: false,
                valid: false,
                error: "Token and email are required",
            });
        }
        const emailLower = String(email).trim().toLowerCase();
        const user = await prisma_1.default.user.findFirst({
            where: {
                email: emailLower,
                resetToken: token,
                resetTokenExpiry: { gt: new Date() },
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                resetTokenExpiry: true,
            },
        });
        if (!user) {
            return res.status(200).json({
                success: false,
                valid: false,
                error: "Invalid or expired reset token",
            });
        }
        return res.json({
            success: true,
            valid: true,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            userId: user.id,
            expiresAt: user.resetTokenExpiry,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Verify reset token error:", err);
        return res.status(200).json({
            success: false,
            valid: false,
            error: "Failed to verify token",
        });
    }
});
// POST /api/auth/reset-password — portal users: token + email; admins: otp + email (no token).
router.post("/reset-password", async (req, res) => {
    try {
        const body = req.body;
        const emailLower = body.email?.trim().toLowerCase();
        const password = body.password;
        const confirmPassword = body.confirmPassword;
        if (!emailLower || !password) {
            return res.status(400).json({ success: false, error: "Email and password are required" });
        }
        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ success: false, error: "Passwords don't match" });
        }
        const pwErr = validatePortalPassword(password);
        if (pwErr) {
            return res.status(400).json({ success: false, error: pwErr, details: pwErr });
        }
        if (body.otp && !body.token) {
            const subAdmin = await prisma_1.default.subAdmin.findFirst({
                where: { email: emailLower, isActive: true },
            });
            const superAdmin = await prisma_1.default.superAdmin.findFirst({
                where: { email: emailLower, isActive: true },
            });
            if (!subAdmin && !superAdmin) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid or expired reset code. Please request a new password reset.",
                });
            }
            const record = await prisma_1.default.otp.findFirst({
                where: { email: emailLower, purpose: OTP_PURPOSE_ADMIN_PASSWORD_RESET },
                orderBy: { createdAt: "desc" },
            });
            if (!record || record.otp !== String(body.otp).trim()) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid or expired reset code. Please request a new password reset.",
                });
            }
            if (record.expiresAt < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid or expired reset code. Please request a new password reset.",
                });
            }
            const same = subAdmin
                ? await bcryptjs_1.default.compare(password, subAdmin.password)
                : await bcryptjs_1.default.compare(password, superAdmin.password);
            if (same) {
                return res.status(400).json({
                    success: false,
                    error: "New password cannot be the same as old password",
                });
            }
            const hashedPassword = await bcryptjs_1.default.hash(password, 12);
            if (subAdmin) {
                await prisma_1.default.subAdmin.update({
                    where: { id: subAdmin.id },
                    data: {
                        password: hashedPassword,
                        loginAttempts: 0,
                        lockoutUntil: null,
                    },
                });
            }
            else {
                await prisma_1.default.superAdmin.update({
                    where: { id: superAdmin.id },
                    data: {
                        password: hashedPassword,
                        loginAttempts: 0,
                        lockoutUntil: null,
                    },
                });
            }
            await prisma_1.default.otp.deleteMany({
                where: { email: emailLower, purpose: OTP_PURPOSE_ADMIN_PASSWORD_RESET },
            });
            return res.json({
                success: true,
                message: "Password has been reset successfully. You can now login with your new password.",
            });
        }
        if (!body.token) {
            return res.status(400).json({
                success: false,
                error: "Reset token or OTP is required",
            });
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                email: emailLower,
                resetToken: body.token,
                resetTokenExpiry: { gt: new Date() },
                isActive: true,
            },
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                error: "Invalid or expired reset token. Please request a new password reset.",
            });
        }
        const isSamePassword = await bcryptjs_1.default.compare(password, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                error: "New password cannot be the same as old password",
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                emailVerified: true,
                resetToken: null,
                resetTokenExpiry: null,
                loginAttempts: 0,
                passwordResetAttempts: 0,
                lastPasswordChange: new Date(),
            },
        });
        return res.json({
            success: true,
            message: "Email verified and password set successfully. You can now login with your new password.",
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Reset password error:", err);
        return res.status(500).json({
            success: false,
            error: "Failed to reset password. Please try again.",
        });
    }
});
// TEMPORARY: POST /api/auth/bootstrap-superadmin
// Creates an initial SUPER_ADMIN when called with the correct secret.
// Remove this route (and the ADMIN_BOOTSTRAP_SECRET env) after bootstrap.
router.post("/bootstrap-superadmin", async (req, res) => {
    try {
        if (!BOOTSTRAP_SECRET) {
            return res.status(403).json({
                message: "Admin bootstrap is not enabled on this server",
            });
        }
        const { secret, email, password, name } = req.body;
        if (!secret || secret !== BOOTSTRAP_SECRET) {
            return res.status(403).json({ message: "Invalid bootstrap secret" });
        }
        if (!email || !password || !name) {
            return res.status(400).json({
                message: "email, password and name are required",
            });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await prisma_1.default.superAdmin.findUnique({
            where: { email: normalizedEmail },
        });
        if (existing) {
            return res.status(200).json({
                success: true,
                message: "SuperAdmin already exists",
                email: existing.email,
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const superAdmin = await prisma_1.default.superAdmin.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword,
                name,
                // Prisma enum AdminRole.SUPER_ADMIN; cast as any to avoid import
                role: "SUPER_ADMIN",
                isActive: true,
                permissions: ["*"],
            },
        });
        return res.status(201).json({
            success: true,
            message: "SuperAdmin created successfully",
            email: superAdmin.email,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Bootstrap superadmin error:", err);
        return res.status(500).json({ message: "Failed to bootstrap super admin" });
    }
});
exports.default = router;
