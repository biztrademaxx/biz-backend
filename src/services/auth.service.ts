import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { UserRole } from "@prisma/client";
import prisma from "../config/prisma";
import { AuthTokenPayload, AuthRole, AuthDomain } from "../modules/auth.types";
import { getDisplayName } from "../utils/display-name";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-jwt-refresh-secret";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthTokenPayload;
  tokens: AuthTokens;
}

function mapUserRoleToAuthRole(role: string | null | undefined): AuthRole {
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

function isAdminRole(role: AuthRole): boolean {
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN";
}

export class AuthService {
  static async authenticateWithCredentials(email: string, password: string): Promise<AuthResult | null> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try SuperAdmin
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: normalizedEmail },
    });

    if (superAdmin) {
      const valid = await bcrypt.compare(password, superAdmin.password);
      if (!valid) {
        return null;
      }

      const payload: AuthTokenPayload = {
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
    const subAdmin = await prisma.subAdmin.findUnique({
      where: { email: normalizedEmail },
    });

    if (subAdmin) {
      const valid = await bcrypt.compare(password, subAdmin.password);
      if (!valid) {
        return null;
      }

      await prisma.subAdmin.update({
        where: { id: subAdmin.id },
        data: { lastLogin: new Date() },
      });

      const payload: AuthTokenPayload = {
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
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return null;
    }

    const validUserPassword = await bcrypt.compare(password, user.password);
    if (!validUserPassword) {
      return null;
    }

    // Venue managers may be delisted from /venues (isVerified=false) but must still be able to sign in.
    if (!user.isActive && user.role !== "VENUE_MANAGER") {
      return null;
    }

    const role = mapUserRoleToAuthRole(user.role);
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email ?? normalizedEmail,
      role,
      domain: "USER",
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar ?? undefined,
      displayName: getDisplayName(user),
    };

    const tokens = AuthService.issueTokens(payload);
    return { user: payload, tokens };
  }

  /**
   * Create or update a portal user from Google/LinkedIn OAuth and issue JWTs.
   * Used by Next.js NextAuth via internal POST /api/auth/oauth-sync.
   */
  static async syncOAuthPortalUser(input: {
    email: string;
    name?: string | null;
    image?: string | null;
    /** Only applied when creating a new user (never upgrades/downgrades existing accounts). */
    intendedRole?: string | null;
  }): Promise<AuthResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    const rawName = (input.name || "").trim();
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "User";
    const lastName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const allowed: UserRole[] = [
        "ATTENDEE",
        "ORGANIZER",
        "EXHIBITOR",
        "SPEAKER",
        "VENUE_MANAGER",
      ];
      const raw = (input.intendedRole ?? "").trim().toUpperCase();
      const roleForCreate =
        raw && (allowed as string[]).includes(raw) ? (raw as UserRole) : "ATTENDEE";

      const hashedPassword = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        10
      );
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          firstName,
          lastName,
          password: hashedPassword,
          avatar: input.image || undefined,
          role: roleForCreate,
          ...(roleForCreate === "VENUE_MANAGER"
            ? { isVerified: false, isActive: true }
            : { isVerified: true, isActive: true }),
          emailVerified: true,
          lastLogin: new Date(),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(input.image ? { avatar: input.image } : {}),
          lastLogin: new Date(),
        },
      });
      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
      });
      if (!refreshed) {
        throw new Error("User not found after OAuth sync");
      }
      user = refreshed;
    }

    if (!user.isActive && user.role !== "VENUE_MANAGER") {
      throw new Error("Account is deactivated");
    }

    const role = mapUserRoleToAuthRole(user.role);
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email ?? normalizedEmail,
      role,
      domain: "USER",
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar ?? undefined,
      displayName: getDisplayName(user),
    };

    const tokens = AuthService.issueTokens(payload);
    return { user: payload, tokens };
  }

  static issueTokens(payload: AuthTokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshToken = jwt.sign(
      {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        domain: payload.domain,
      },
      JWT_REFRESH_SECRET,
      {
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      }
    );

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string): AuthTokenPayload {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  }

  static verifyRefreshToken(token: string): Pick<AuthTokenPayload, "sub" | "email" | "role" | "domain"> {
    return jwt.verify(token, JWT_REFRESH_SECRET) as Pick<AuthTokenPayload, "sub" | "email" | "role" | "domain">;
  }

  static async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const decoded = AuthService.verifyRefreshToken(refreshToken);

    // Re-hydrate from DB to ensure account is still valid and get latest permissions
    if (decoded.domain === "ADMIN") {
      const admin =
        (await prisma.superAdmin.findUnique({ where: { id: decoded.sub } })) ??
        (await prisma.subAdmin.findUnique({ where: { id: decoded.sub } }));

      if (!admin) {
        throw new Error("Admin not found");
      }

      const isSuper = "role" in admin && admin.role === "SUPER_ADMIN";
      const role: AuthRole = isSuper ? "SUPER_ADMIN" : "SUB_ADMIN";
      const domain: AuthDomain = "ADMIN";

      const payload: AuthTokenPayload = {
        sub: admin.id,
        email: admin.email,
        role,
        domain,
        permissions: (admin as any).permissions ?? [],
        firstName: (admin as any).name,
      };

      return AuthService.issueTokens(payload);
    }

    // Regular user
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.isActive && user.role !== "VENUE_MANAGER") {
      throw new Error("Account is deactivated");
    }

    const role = mapUserRoleToAuthRole(user.role);
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email ?? decoded.email,
      role,
      domain: "USER",
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar ?? undefined,
      displayName: getDisplayName(user),
    };

    return AuthService.issueTokens(payload);
  }
}

