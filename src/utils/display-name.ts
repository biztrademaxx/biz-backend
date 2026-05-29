/** Fields needed to compute a role-aware dashboard display name (no DB schema change). */
export type DisplayNameUserInput = {
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
  company?: string | null;
};

function normalizeWhitespace(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function fullName(first?: string | null, last?: string | null): string {
  return normalizeWhitespace(`${normalizeWhitespace(first)} ${normalizeWhitespace(last)}`);
}

/**
 * Role-based display name for dashboards and API payloads.
 * - ORGANIZER: organizationName → firstName → "User"
 * - EXHIBITOR: organizationName || company → firstName → "User"
 * - SPEAKER / ATTENDEE: firstName + lastName → "User"
 * - Other roles: firstName + lastName → "User"
 */
export function getDisplayName(user: DisplayNameUserInput): string {
  const role = String(user.role ?? "").toUpperCase();

  switch (role) {
    case "ORGANIZER": {
      const org =
        normalizeWhitespace(user.organizationName) || normalizeWhitespace(user.company);
      if (org) return org;
      const fn = normalizeWhitespace(user.firstName);
      if (fn) return fn;
      return "User";
    }
    case "EXHIBITOR": {
      const primary =
        normalizeWhitespace(user.organizationName) || normalizeWhitespace(user.company);
      if (primary) return primary;
      const fn = normalizeWhitespace(user.firstName);
      if (fn) return fn;
      return "User";
    }
    case "SPEAKER":
    case "ATTENDEE": {
      const n = fullName(user.firstName, user.lastName);
      return n || "User";
    }
    default: {
      const n = fullName(user.firstName, user.lastName);
      return n || "User";
    }
  }
}
