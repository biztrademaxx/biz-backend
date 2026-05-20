"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respondWithAdminError = respondWithAdminError;
const client_1 = require("@prisma/client");
const admin_response_1 = require("./admin-response");
/** Send an appropriate JSON error for admin route handlers. Always ends the response. */
function respondWithAdminError(res, e, fallback500) {
    if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
            (0, admin_response_1.sendError)(res, 400, "A record with this unique value already exists (e.g. duplicate slug).", e.meta ? JSON.stringify(e.meta) : undefined);
            return;
        }
        if (e.code === "P2021") {
            (0, admin_response_1.sendError)(res, 503, "Database schema is out of date. From the backend folder run: npx prisma migrate deploy", e.message);
            return;
        }
    }
    const msg = e instanceof Error ? e.message : typeof e === "string" ? e : fallback500;
    if (msg.includes("Name is required") ||
        msg.includes("Could not derive slug") ||
        msg.includes("Role is required") ||
        msg.includes("Unknown or inactive role")) {
        (0, admin_response_1.sendError)(res, 400, msg);
        return;
    }
    if (msg.includes("already exists") ||
        msg.includes("already in use") ||
        msg.includes("Cannot change") ||
        msg.includes("Cannot delete") ||
        msg.includes("sub-admin(s) use this role")) {
        (0, admin_response_1.sendError)(res, 400, msg);
        return;
    }
    if (msg.includes("does not exist") &&
        (msg.includes("admin_role_definitions") || msg.includes("relation") || msg.includes("table"))) {
        (0, admin_response_1.sendError)(res, 503, "Database schema is out of date. From the backend folder run: npx prisma migrate deploy", msg);
        return;
    }
    (0, admin_response_1.sendError)(res, 500, fallback500, msg);
}
