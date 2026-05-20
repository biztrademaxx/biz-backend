"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.ORGANIZER_PENDING_APPROVAL = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../config/prisma"));
const display_name_1 = require("../utils/display-name");
const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-jwt-refresh-secret";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** Thrown when an organizer has not been approved by admin yet (no JWT). */
exports.ORGANIZER_PENDING_APPROVAL = "ORGANIZER_PENDING_APPROVAL";
function mapUserRoleToAuthRole(role) {
    const r = (role || "").toUpperCase();
    switch (r) {
        case "ORGANIZER":
            return "ORGANIZER";
        case "EXHIBITOR":
            return "EXHIBITOR";
        case "VENUE_MANAGER":
            return "VENUE_MANAGER";
        case "SPEAKER":
            return "SPEAKER";
        case "ATTENDEE":
            return "ATTENDEE";
        case "SUPER_ADMIN":
            return "SUPER_ADMIN";
        case "SUB_ADMIN":
            return "SUB_ADMIN";
        default:
            return "USER";
    }
}
function isAdminRole(role) {
    return role === "SUPER_ADMIN" || role === "SUB_ADMIN";
}
class AuthService {
    static async authenticateWithCredentials(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        // 1. Try SuperAdmin
        const superAdmin = await prisma_1.default.superAdmin.findUnique({
            where: { email: normalizedEmail },
        });
        if (superAdmin) {
            const valid = await bcryptjs_1.default.compare(password, superAdmin.password);
            if (!valid) {
                return null;
            }
            const payload = {
                sub: superAdmin.id,
                email: superAdmin.email,
                role: "SUPER_ADMIN",
                domain: "ADMIN",
                permissions: superAdmin.permissions ?? [],
                firstName: superAdmin.name,
            };
            const tokens = AuthService.issueTokens(payload);
            return { user: payload, tokens };
        }
        // 2. Try SubAdmin
        const subAdmin = await prisma_1.default.subAdmin.findUnique({
            where: { email: normalizedEmail },
        });
        if (subAdmin) {
            const valid = await bcryptjs_1.default.compare(password, subAdmin.password);
            if (!valid) {
                return null;
            }
            await prisma_1.default.subAdmin.update({
                where: { id: subAdmin.id },
                data: { lastLogin: new Date() },
            });
            const payload = {
                sub: subAdmin.id,
                email: subAdmin.email,
                role: "SUB_ADMIN",
                domain: "ADMIN",
                permissions: subAdmin.permissions ?? [],
                firstName: subAdmin.name,
            };
            const tokens = AuthService.issueTokens(payload);
            return { user: payload, tokens };
        }
        // 3. Fallback to regular User
        const user = await prisma_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            return null;
        }
        const validUserPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validUserPassword) {
            return null;
        }
        if (user.role === "ORGANIZER" && !user.isVerified) {
            throw new Error(exports.ORGANIZER_PENDING_APPROVAL);
        }
        // Venue managers may be delisted from /venues (isVerified=false) but must still be able to sign in.
        if (!user.isActive && user.role !== "VENUE_MANAGER") {
            return null;
        }
        const role = mapUserRoleToAuthRole(user.role);
        const payload = {
            sub: user.id,
            email: user.email ?? normalizedEmail,
            role,
            domain: "USER",
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar ?? undefined,
            displayName: (0, display_name_1.getDisplayName)(user),
        };
        const tokens = AuthService.issueTokens(payload);
        return { user: payload, tokens };
    }
    /**
     * Create or update a portal user from Google/LinkedIn OAuth and issue JWTs.
     * Used by Next.js NextAuth via internal POST /api/auth/oauth-sync.
     */
    static async syncOAuthPortalUser(input) {
        const normalizedEmail = input.email.trim().toLowerCase();
        if (!normalizedEmail) {
            throw new Error("Email is required");
        }
        const rawName = (input.name || "").trim();
        const nameParts = rawName.split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || "User";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";
        let user = await prisma_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            const allowed = [
                "ATTENDEE",
                "ORGANIZER",
                "EXHIBITOR",
                "SPEAKER",
                "VENUE_MANAGER",
            ];
            const raw = (input.intendedRole ?? "").trim().toUpperCase();
            const roleForCreate = raw && allowed.includes(raw) ? raw : "ATTENDEE";
            const hashedPassword = await bcryptjs_1.default.hash(crypto_1.default.randomBytes(32).toString("hex"), 10);
            user = await prisma_1.default.user.create({
                data: {
                    email: normalizedEmail,
                    firstName,
                    lastName,
                    password: hashedPassword,
                    avatar: input.image || undefined,
                    role: roleForCreate,
                    ...(roleForCreate === "VENUE_MANAGER" || roleForCreate === "ORGANIZER"
                        ? { isVerified: false, isActive: true }
                        : { isVerified: true, isActive: true }),
                    emailVerified: true,
                    lastLogin: new Date(),
                },
            });
        }
        else {
            await prisma_1.default.user.update({
                where: { id: user.id },
                data: {
                    ...(input.image ? { avatar: input.image } : {}),
                    lastLogin: new Date(),
                },
            });
            const refreshed = await prisma_1.default.user.findUnique({
                where: { id: user.id },
            });
            if (!refreshed) {
                throw new Error("User not found after OAuth sync");
            }
            user = refreshed;
        }
        if (user.role === "ORGANIZER" && !user.isVerified) {
            throw new Error(exports.ORGANIZER_PENDING_APPROVAL);
        }
        if (!user.isActive && user.role !== "VENUE_MANAGER") {
            throw new Error("Account is deactivated");
        }
        const role = mapUserRoleToAuthRole(user.role);
        const payload = {
            sub: user.id,
            email: user.email ?? normalizedEmail,
            role,
            domain: "USER",
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar ?? undefined,
            displayName: (0, display_name_1.getDisplayName)(user),
        };
        const tokens = AuthService.issueTokens(payload);
        return { user: payload, tokens };
    }
    static issueTokens(payload) {
        const accessToken = jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
            expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        });
        const refreshToken = jsonwebtoken_1.default.sign({
            sub: payload.sub,
            email: payload.email,
            role: payload.role,
            domain: payload.domain,
        }, JWT_REFRESH_SECRET, {
            expiresIn: REFRESH_TOKEN_TTL_SECONDS,
        });
        return { accessToken, refreshToken };
    }
    static verifyAccessToken(token) {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    static verifyRefreshToken(token) {
        return jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
    }
    static async refreshTokens(refreshToken) {
        const decoded = AuthService.verifyRefreshToken(refreshToken);
        // Re-hydrate from DB to ensure account is still valid and get latest permissions
        if (decoded.domain === "ADMIN") {
            const admin = (await prisma_1.default.superAdmin.findUnique({ where: { id: decoded.sub } })) ??
                (await prisma_1.default.subAdmin.findUnique({ where: { id: decoded.sub } }));
            if (!admin) {
                throw new Error("Admin not found");
            }
            const isSuper = "role" in admin && admin.role === "SUPER_ADMIN";
            const role = isSuper ? "SUPER_ADMIN" : "SUB_ADMIN";
            const domain = "ADMIN";
            const payload = {
                sub: admin.id,
                email: admin.email,
                role,
                domain,
                permissions: admin.permissions ?? [],
                firstName: admin.name,
            };
            return AuthService.issueTokens(payload);
        }
        // Regular user
        const user = await prisma_1.default.user.findUnique({ where: { id: decoded.sub } });
        if (!user) {
            throw new Error("User not found");
        }
        if (user.role === "ORGANIZER" && !user.isVerified) {
            throw new Error(exports.ORGANIZER_PENDING_APPROVAL);
        }
        if (!user.isActive && user.role !== "VENUE_MANAGER") {
            throw new Error("Account is deactivated");
        }
        const role = mapUserRoleToAuthRole(user.role);
        const payload = {
            sub: user.id,
            email: user.email ?? decoded.email,
            role,
            domain: "USER",
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar ?? undefined,
            displayName: (0, display_name_1.getDisplayName)(user),
        };
        return AuthService.issueTokens(payload);
    }
}
exports.AuthService = AuthService;
