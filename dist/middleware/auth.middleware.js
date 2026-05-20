"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUserOrInternal = requireUserOrInternal;
exports.optionalUser = optionalUser;
exports.requireUserApp = requireUserApp;
exports.requireUser = requireUser;
exports.requireAdmin = requireAdmin;
exports.requireSuperAdmin = requireSuperAdmin;
exports.requirePermission = requirePermission;
const auth_service_1 = require("../services/auth.service");
const prisma_1 = __importDefault(require("../config/prisma"));
function extractTokenFromHeader(req) {
    const header = req.headers.authorization;
    if (!header)
        return null;
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token)
        return null;
    return token;
}
/** Allow either JWT or X-Internal-Secret (for Next.js server-to-backend calls). */
function requireUserOrInternal(req, res, next) {
    const secret = process.env.INTERNAL_API_SECRET;
    const provided = req.headers["x-internal-secret"];
    if (secret && provided === secret) {
        req.auth = { sub: "internal", email: "internal@server", role: "USER", domain: "USER" };
        return next();
    }
    return requireUser(req, res, next);
}
/** If a valid JWT is present, set req.auth; otherwise continue without it (no 401). Use for routes that support both anonymous and logged-in users. */
function optionalUser(req, _res, next) {
    try {
        const token = extractTokenFromHeader(req);
        if (!token)
            return next();
        const payload = auth_service_1.AuthService.verifyAccessToken(token);
        req.auth = payload;
        const userId = payload.sub;
        if (userId && userId !== "internal") {
            prisma_1.default.user.updateMany({ where: { id: userId }, data: { lastLogin: new Date() } }).catch(() => { });
        }
        return next();
    }
    catch {
        // Caller sent a Bearer token but it was invalid/expired — downstream can return 401 so clients refresh.
        req.hadInvalidAuthToken = true;
        return next();
    }
}
/** End-user app (organizer, speaker, etc.) — rejects admin JWTs. */
function requireUserApp(req, res, next) {
    if (!req.auth) {
        return res.status(401).json({ message: "Authorization required" });
    }
    if (req.auth.domain !== "USER") {
        return res.status(403).json({ message: "User account required" });
    }
    return next();
}
function requireUser(req, res, next) {
    try {
        const token = extractTokenFromHeader(req);
        if (!token) {
            return res.status(401).json({ message: "Authorization token missing" });
        }
        const payload = auth_service_1.AuthService.verifyAccessToken(token);
        req.auth = payload;
        // Update lastLogin for presence (green dot); fire-and-forget to avoid blocking
        const userId = payload.sub;
        if (userId && userId !== "internal") {
            prisma_1.default.user.updateMany({ where: { id: userId }, data: { lastLogin: new Date() } }).catch(() => { });
        }
        return next();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Auth error (requireUser):", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
function requireAdmin(req, res, next) {
    try {
        const token = extractTokenFromHeader(req);
        if (!token) {
            return res.status(401).json({ message: "Authorization token missing" });
        }
        const payload = auth_service_1.AuthService.verifyAccessToken(token);
        if (payload.domain !== "ADMIN") {
            return res.status(403).json({ message: "Admin access required" });
        }
        if (payload.role !== "SUPER_ADMIN" && payload.role !== "SUB_ADMIN") {
            return res.status(403).json({ message: "Admin role required" });
        }
        req.auth = payload;
        return next();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Auth error (requireAdmin):", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
function requireSuperAdmin(req, res, next) {
    try {
        const token = extractTokenFromHeader(req);
        if (!token) {
            return res.status(401).json({ message: "Authorization token missing" });
        }
        const payload = auth_service_1.AuthService.verifyAccessToken(token);
        if (payload.domain !== "ADMIN" || payload.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Super admin access required" });
        }
        req.auth = payload;
        return next();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Auth error (requireSuperAdmin):", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
/**
 * Use after requireAdmin. SUPER_ADMIN bypasses; SUB_ADMIN must have the permission in token.permissions.
 */
function requirePermission(permissionName) {
    return (req, res, next) => {
        if (!req.auth) {
            return res.status(401).json({ message: "Authorization required" });
        }
        if (req.auth.role === "SUPER_ADMIN") {
            return next();
        }
        const permissions = req.auth.permissions ?? [];
        if (permissions.includes(permissionName)) {
            return next();
        }
        return res.status(403).json({
            message: "Insufficient permissions",
            required: permissionName,
        });
    };
}
