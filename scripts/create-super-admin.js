// backend/scripts/create-super-admin.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.split("=");
    const normalizedKey = key.replace(/^--/, "");
    if (inlineValue !== undefined) {
      parsed[normalizedKey] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[normalizedKey] = next;
      i += 1;
    } else {
      parsed[normalizedKey] = "true";
    }
  }
  return parsed;
}

function assertStrongPassword(password) {
  // Minimum 12 chars, upper/lower/number/special
  const strong =
    typeof password === "string" &&
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (!strong) {
    throw new Error(
      "Weak password. Use at least 12 chars with uppercase, lowercase, number, and special character."
    );
  }
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Security gate: script only works when explicitly enabled and authorized.
  const bootstrapEnabled = process.env.ADMIN_BOOTSTRAP_ENABLED === "true";
  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!bootstrapEnabled) {
    throw new Error("Blocked. Set ADMIN_BOOTSTRAP_ENABLED=true for one-time bootstrap.");
  }
  if (!bootstrapSecret) {
    throw new Error("Blocked. ADMIN_BOOTSTRAP_SECRET is required.");
  }
  // If --secret is passed, it must match .env (optional: npm on Windows often drops args; .env alone is enough when ENABLE=true).
  if (args.secret && !safeEqual(args.secret, bootstrapSecret)) {
    throw new Error("Blocked. Invalid bootstrap secret (--secret does not match ADMIN_BOOTSTRAP_SECRET in .env).");
  }

  const email = String(args.email || "").trim().toLowerCase();
  const password = String(args.password || "");
  const name = String(args.name || "Super Admin").trim();
  const phone = args.phone ? String(args.phone).trim() : null;

  if (!email) throw new Error("Missing --email");
  if (!password) throw new Error("Missing --password");
  assertStrongPassword(password);

  const existingAdmins = await prisma.superAdmin.count();
  if (existingAdmins > 0 && args.force !== "true") {
    throw new Error(
      "Super admin already exists. Use normal admin flows. To override intentionally, pass --force=true."
    );
  }

  const existingEmail = await prisma.superAdmin.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error(`Super admin with email ${email} already exists.`);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const superAdmin = await prisma.superAdmin.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      permissions: [
        "Dashboard Overview",
        "Events Management",
        "Organizer Management",
        "Exhibitor Management",
        "Speaker Management",
        "Venue Management",
        "Visitor Management",
        "Financial & Transactions",
        "Content Management",
        "Marketing & Communication",
        "Reports & Analytics",
        "Integrations",
        "User Roles & Permissions",
        "Settings & Configuration",
        "Help & Support",
      ],
      isActive: true,
    },
  });

  console.log("Super admin created successfully.");
  console.log({ id: superAdmin.id, email: superAdmin.email, createdAt: superAdmin.createdAt });
  console.log("Important: rotate ADMIN_BOOTSTRAP_SECRET and set ADMIN_BOOTSTRAP_ENABLED=false now.");
}

main()
  .catch((e) => {
    console.error("[create-super-admin] failed:", e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });