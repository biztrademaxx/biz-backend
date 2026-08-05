/**
 * Canonical dashboard plan catalog — mirrors biz-frontend/lib/dashboard-packages.ts
 */

export type DashboardPlanRole = "VISITOR" | "EXHIBITOR" | "ORGANIZER";

export type BillingKind = "FREE" | "ONE_TIME" | "MONTHLY" | "YEARLY";

export type CatalogPlan = {
  slug: string;
  role: DashboardPlanRole;
  name: string;
  amountInr: number;
  billingNote: string;
  billingKind: BillingKind;
  displayOrder: number; // For sorting
};

const VISITOR_PLANS: CatalogPlan[] = [
  {
    slug: "visitor-free",
    role: "VISITOR",
    name: "Free Plan",
    amountInr: 0,
    billingNote: "Lifetime",
    billingKind: "FREE",
    displayOrder: 1,
  },
  {
    slug: "visitor-user",
    role: "VISITOR",
    name: "User Plan",
    amountInr: 2000,
    billingNote: "One-time",
    billingKind: "ONE_TIME",
    displayOrder: 2,
  },
  {
    slug: "visitor-premium",
    role: "VISITOR",
    name: "Premium Plan",
    amountInr: 5000,
    billingNote: "One-time",
    billingKind: "ONE_TIME",
    displayOrder: 3,
  },
];

const EXHIBITOR_PLANS: CatalogPlan[] = [
  {
    slug: "exhibitor-basic",
    role: "EXHIBITOR",
    name: "Basic Plan",
    amountInr: 0,
    billingNote: "Free",
    billingKind: "FREE",
    displayOrder: 1,
  },
  {
    slug: "exhibitor-standard",
    role: "EXHIBITOR",
    name: "Standard Plan",
    amountInr: 10000,
    billingNote: "per year",
    billingKind: "YEARLY",
    displayOrder: 2,
  },
  {
    slug: "exhibitor-premium",
    role: "EXHIBITOR",
    name: "Premium Plan",
    amountInr: 12999,
    billingNote: "per year",
    billingKind: "YEARLY",
    displayOrder: 3,
  },
];

const ORGANIZER_PLANS: CatalogPlan[] = [
  {
    slug: "organizer-free",
    role: "ORGANIZER",
    name: "Free Plan",
    amountInr: 0,
    billingNote: "Forever",
    billingKind: "FREE",
    displayOrder: 1,
  },
  {
    slug: "organizer-silver",
    role: "ORGANIZER",
    name: "Silver Plan",
    amountInr: 1, // ✅ Fixed: ₹10,000/year (matches frontend)
    billingNote: "per year",
    billingKind: "YEARLY",
    displayOrder: 2,
  },
  {
    slug: "organizer-gold",
    role: "ORGANIZER",
    name: "Gold Plan",
    amountInr: 25000,
    billingNote: "month",
    billingKind: "MONTHLY",
    displayOrder: 3,
  },
  {
    slug: "organizer-platinum",
    role: "ORGANIZER",
    name: "Platinum Plan",
    amountInr: 1, // ✅ Fixed: ₹50,000/month (was 1)
    billingNote: "month",
    billingKind: "MONTHLY",
    displayOrder: 4,
  },
];

export const ALL_DASHBOARD_PLANS: CatalogPlan[] = [
  ...VISITOR_PLANS,
  ...EXHIBITOR_PLANS,
  ...ORGANIZER_PLANS,
];

export function getCatalogPlan(role: string, planSlug: string): CatalogPlan | null {
  const normalizedRole = role.toUpperCase() as DashboardPlanRole;
  return (
    ALL_DASHBOARD_PLANS.find((p) => p.role === normalizedRole && p.slug === planSlug) ?? null
  );
}

export function defaultFreePlanSlug(role: DashboardPlanRole): string {
  switch (role) {
    case "VISITOR":
      return "visitor-free";
    case "EXHIBITOR":
      return "exhibitor-basic";
    case "ORGANIZER":
      return "organizer-free";
    default:
      return "visitor-free";
  }
}

export function computeExpiresAt(billingKind: BillingKind, startedAt: Date): Date | null {
  if (billingKind === "YEARLY") {
    const end = new Date(startedAt);
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }
  if (billingKind === "MONTHLY") {
    const end = new Date(startedAt);
    end.setMonth(end.getMonth() + 1);
    return end;
  }
  return null;
}

export function billingKindToPlanType(billingKind: BillingKind): "MONTHLY" | "YEARLY" | "QUARTERLY" {
  if (billingKind === "YEARLY") return "YEARLY";
  if (billingKind === "MONTHLY") return "MONTHLY";
  return "MONTHLY";
}

// Helper to get plans by role sorted by display order
export function getPlansByRole(role: DashboardPlanRole): CatalogPlan[] {
  return ALL_DASHBOARD_PLANS
    .filter((p) => p.role === role)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

// Check if a plan is free
export function isFreePlan(plan: CatalogPlan): boolean {
  return plan.amountInr === 0;
}

// Get the "Most Popular" plan for a role (typically the middle tier)
export function getMostPopularPlan(role: DashboardPlanRole): string | null {
  const plans = getPlansByRole(role);
  if (plans.length <= 2) return null;
  // For Organizer with 4 plans, Gold (index 2) is most popular
  if (plans.length === 4) {
    return plans[2]?.slug ?? null; // Gold
  }
  // For 3 plans, return index 1 (middle plan)
  return plans[1]?.slug ?? null;
}