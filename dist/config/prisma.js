"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
/**
 * Neon/serverless examples often use `connection_limit=1`. That breaks a long‑running
 * Node server whenever Prisma runs 2+ queries at once (e.g. Promise.all), causing P2024.
 * Bump to a small pool; tune in DATABASE_URL if you need more concurrent DB work.
 */
function resolveDatabaseUrl(url) {
    if (!url)
        return url;
    if (/connection_limit=1(?!\d)/i.test(url)) {
        const next = url.replace(/connection_limit=1(?!\d)/gi, "connection_limit=5");
        if (process.env.NODE_ENV !== "test") {
            // eslint-disable-next-line no-console
            console.warn("[prisma] DATABASE_URL had connection_limit=1; using connection_limit=5 to avoid pool timeouts (P2024). Set connection_limit≥5 in .env for a long‑running API.");
        }
        return next;
    }
    return url;
}
// Extend global type to hold the Prisma instance in development
const globalForPrisma = globalThis;
const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        ...(databaseUrl
            ? {
                datasources: {
                    db: { url: databaseUrl },
                },
            }
            : {}),
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = exports.prisma;
}
exports.default = exports.prisma;
