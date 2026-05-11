"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middleware/error.middleware");
/**
 * Comma-separated `CORS_ORIGIN`, e.g.
 * `https://your-app.vercel.app,http://localhost:3000`
 *
 * With `credentials: true`, browsers reject `Access-Control-Allow-Origin: *`. We reflect the
 * request `Origin` when it is allowed (or when `*` appears in the list for local testing).
 */
function corsAllowedOrigins() {
    const raw = process.env.CORS_ORIGIN?.trim();
    const fallback = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001";
    const list = (raw && raw.length > 0 ? raw : fallback)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const allowAny = list.includes("*");
    const origins = new Set(list.filter((o) => o !== "*"));
    return { allowAny, origins };
}
/** When `CORS_ALLOW_VERCEL_APP=true`, allow any `https://*.vercel.app` preview / production URL. */
function isVercelAppHttpsOrigin(origin) {
    try {
        const u = new URL(origin);
        if (u.protocol !== "https:")
            return false;
        const host = u.hostname.toLowerCase();
        return host.endsWith(".vercel.app");
    }
    catch {
        return false;
    }
}
/**
 * Builds the Express application (no listen, no env validation, no background jobs).
 * Used by the HTTP server and by integration tests.
 */
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use(express_1.default.json());
    const { allowAny, origins } = corsAllowedOrigins();
    const allowVercelApp = process.env.CORS_ALLOW_VERCEL_APP?.trim().toLowerCase() === "true";
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }
            if (allowAny || origins.has(origin)) {
                return callback(null, true);
            }
            if (allowVercelApp && isVercelAppHttpsOrigin(origin)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
        /** Ensures preflight for `Authorization` + multipart + internal proxy header always succeeds. */
        allowedHeaders: ["Authorization", "Content-Type", "X-Internal-Secret", "X-Requested-With"],
        methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }));
    app.use((0, compression_1.default)());
    if (process.env.NODE_ENV === "development") {
        app.use((0, morgan_1.default)("dev"));
    }
    const authLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use("/api/auth", authLimiter);
    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });
    app.use("/api", routes_1.default);
    app.use(error_middleware_1.errorHandler);
    return app;
}
