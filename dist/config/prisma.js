"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
/**
 * Prisma client pool size defaults to ~num_cpus*2+1 (often 3 on 1‑vCPU EC2).
 * A long‑running API routinely runs Promise.all([findMany, count]) plus other
 * work; a pool of 3 causes P2024 under light concurrency — especially with Neon
 * pooler. Use a modest default when unset; never invent a huge limit.
 *
 * Explicit connection_limit in DATABASE_URL always wins (except literal =1,
 * which is common in Neon serverless snippets and is too small for this app).
 */
const DEFAULT_CONNECTION_LIMIT = 8;
function resolveDatabaseUrl(url) {
    if (!url)
        return url;
    if (/connection_limit=1(?!\d)/i.test(url)) {
        const next = url.replace(/connection_limit=1(?!\d)/gi, `connection_limit=${DEFAULT_CONNECTION_LIMIT}`);
        if (process.env.NODE_ENV !== "test") {
            // eslint-disable-next-line no-console
            console.warn(`[prisma] DATABASE_URL had connection_limit=1; using connection_limit=${DEFAULT_CONNECTION_LIMIT} to avoid pool timeouts (P2024).`);
        }
        return next;
    }
    if (!/connection_limit=\d+/i.test(url)) {
        const sep = url.includes("?") ? "&" : "?";
        const next = `${url}${sep}connection_limit=${DEFAULT_CONNECTION_LIMIT}`;
        if (process.env.NODE_ENV !== "test") {
            // eslint-disable-next-line no-console
            console.warn(`[prisma] DATABASE_URL had no connection_limit; defaulting to ${DEFAULT_CONNECTION_LIMIT} (Prisma would otherwise use ~cpus*2+1, often 3 on small EC2).`);
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
