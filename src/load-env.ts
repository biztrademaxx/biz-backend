/**
 * Load `.env` before any other module reads `process.env`.
 * PM2 does not load `.env` by default; this matches `npm run dev` behavior.
 *
 * Use the directory containing this file's compiled output (`dist/`), not `process.cwd()`.
 * Otherwise PM2 started from `/root` loads `/root/.env` instead of `.../biz-backend/.env`.
 */
import path from "path";
import { config } from "dotenv";

const projectRoot = path.resolve(__dirname, "..");
config({ path: path.join(projectRoot, ".env") });
