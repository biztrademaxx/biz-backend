# Biz Backend (PostgreSQL / Neon)

Express + TypeScript API. Uses **PostgreSQL** (Neon) and Prisma. No MongoDB/Mongoose.

## Setup

1. **Install dependencies** (from this folder)

   ```bash
   cd biz-backend
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env`
   - Set `DATABASE_URL` to your Neon PostgreSQL connection string (see `.env.example`).
   - **CORS (required for Vercel + browser login):** set `CORS_ORIGIN` to a comma-separated list of allowed web origins (no spaces). Example for production + local dev:

     `CORS_ORIGIN=https://your-app.vercel.app,http://localhost:3000`

     The API uses `credentials: true`, so `*` is not valid for browser requests; your frontend’s exact `https://…` origin must be listed.

   - **Vercel previews:** each deployment gets a different `*.vercel.app` URL. Either add every URL to `CORS_ORIGIN`, or set **`CORS_ALLOW_VERCEL_APP=true`** (allows all `https://*.vercel.app` origins — still requires JWT for protected routes).

   - **Email (OTP, password reset):** On many VPS providers, **outbound SMTP to Gmail (ports 465/587) is blocked**. Recommended: **[Resend](https://resend.com)** over HTTPS:
     - `RESEND_API_KEY` — API key from Resend (`re_…`).
     - `RESEND_FROM_EMAIL` — sender on a **domain you verified in Resend** (e.g. `noreply@biztradefairs.com`). Use the same address in the Resend dashboard for DNS.
     - If `RESEND_API_KEY` is unset, the app can use **SendGrid** (`SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL`), or **Gmail SMTP** (`EMAIL_USER` / `EMAIL_PASS`).

3. **Database**
   - Create tables (no migrations): `npx prisma db push`
   - Or use migrations: `npx prisma migrate dev --name init`

4. **Generate Prisma Client**

   ```bash
   npx prisma generate
   ```

5. **Run**

   ```bash
   npm run dev
   ```

   API: `http://localhost:4000` (or `PORT` from env).

## DB: PostgreSQL (Neon)

- Schema: `prisma/schema.prisma`
- All IDs are `uuid()`; no MongoDB ObjectId.
- OTP is stored in Prisma model `Otp` (table `otps`), not Mongoose.
- **`DATABASE_URL` (pooler):** For a **long‑running Express** process, do **not** use `connection_limit=1` in the URL (it causes Prisma **P2024** when multiple queries run at once). Use at least **`connection_limit=5`**, or omit it and let the app normalize a lone `1` → `5` at startup (see `src/config/prisma.ts`). Keep **`DIRECT_URL`** as the non‑pooler URL for migrations.

## Testing

API integration tests use **Jest** + **Supertest**. Prisma is replaced with a manual mock (`src/config/__mocks__/prisma.ts`), so tests do not open a real database.

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server (ts-node) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled app |
| `npm test` | Jest + Supertest (no real DB) |
| `npm run db:generate` | Prisma generate |
| `npm run db:push` | Push schema to DB (no migration history) |
| `npm run db:migrate` | Run migrations |

## Small VPS (512MB) + PM2

`npm run build` (Prisma + `tsc`) can hit **JavaScript heap out of memory** on a 512MB droplet. Options:

1. **Build on a larger machine or CI**, then deploy only `dist/`, `node_modules/`, `package.json`, and `.env`.
2. **Or** on the server, `npm run build` runs `tsc` with `--max-old-space-size=512` (this project needs more than Node’s default ~256MB). On a **512MB RAM** droplet the compile can still fail without **swap**—add 1–2GB swap, or build on your PC/CI and upload `dist/`.
3. **Run** the API with a bounded heap so the OS keeps headroom: use the included PM2 file — `pm2 start ecosystem.config.cjs` (sets `--max-old-space-size=384` and `max_memory_restart`). After editing `.env`: `pm2 restart biz-backend --update-env`.

The app loads **`<project>/biz-backend/.env`** from the install directory (not `process.cwd()`), so SendGrid/DB keys in `~/biz-backend/.env` are used even if PM2 was started from another directory.

## Latency (Vercel + DigitalOcean + Neon)

- **Region:** Put **Neon** in the same (or closest) region as the **DigitalOcean droplet**. Cross-region adds noticeable RTT on every Prisma query.
- **Neon:** Use the **pooler** in `DATABASE_URL` and avoid `connection_limit=1` for this long-running API (see DB section).
- **Droplet:** **512MB / 1 vCPU** is tight under concurrent traffic; more RAM/CPU often beats only upgrading Neon.
- **Frontend:** Public GET routes such as **`/api/events`**, search, stats, and recent events use **short HTTP cache / Next `revalidate`** so Vercel does not call the droplet on every page view.

After adding a Prisma `@@index` (e.g. on `events`), run **`npx prisma db push`** or your migration flow against production.

### SendGrid / Resend `EMAIL_VENDOR` on `/send-otp`

That code means the email provider returned an API error (bad key, unverified sender/domain, etc.). Check logs for `[email.service] Resend API error` or `[email.service] SendGrid HTTP`. **`EMAIL_NETWORK`** means the HTTP client could not complete the request (timeout, etc.). Set `EXPOSE_EMAIL_ERRORS=true` temporarily for JSON `detail` (then disable).
