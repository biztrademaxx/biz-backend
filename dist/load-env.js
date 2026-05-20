"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Load `.env` before any other module reads `process.env`.
 * PM2 does not load `.env` by default; this matches `npm run dev` behavior.
 *
 * Use the directory containing this file's compiled output (`dist/`), not `process.cwd()`.
 * Otherwise PM2 started from `/root` loads `/root/.env` instead of `.../biz-backend/.env`.
 */
const path_1 = __importDefault(require("path"));
const dotenv_1 = require("dotenv");
const projectRoot = path_1.default.resolve(__dirname, "..");
(0, dotenv_1.config)({ path: path_1.default.join(projectRoot, ".env") });
