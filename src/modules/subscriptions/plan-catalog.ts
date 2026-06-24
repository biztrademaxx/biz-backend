/** Canonical dashboard plan catalog — mirrors biz-frontend/lib/dashboard-packages.ts */

export type DashboardPlanRole = "VISITOR" | "EXHIBITOR" | "ORGANIZER";

export type BillingKind = "FREE" | "ONE_TIME" | "YEARLY";

export type CatalogPlan = {
  slug: string;
  role: DashboardPlanRole;
  name: string;
  amountInr: number;
  billingNote: string;
  billingKind: BillingKind;
};

const VISITOR_PLANS: CatalogPlan[] = [
  {
    slug: "visitor-free",
    role: "VISITOR",
    name: "Free Plan",
    amountInr: 0,
    billingNote: "Lifetime",
    billingKind: "FREE",
  },
  {
    slug: "visitor-user",
    role: "VISITOR",
    name: "User Plan",
    amountInr: 2000,
    billingNote: "One-time",
    billingKind: "ONE_TIME",
  },
  {
    slug: "visitor-premium",
    role: "VISITOR",
    name: "Premium Plan",
    amountInr: 5000,
    billingNote: "One-time",
    billingKind: "ONE_TIME",
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
  },
  {
    slug: "exhibitor-standard",
    role: "EXHIBITOR",
    name: "Standard Plan",
    amountInr: 1,
    billingNote: "per year",
    billingKind: "YEARLY",
  },
  {
    slug: "exhibitor-premium",
    role: "EXHIBITOR",
    name: "Premium Plan",
    amountInr: 12999,
    billingNote: "per year",
    billingKind: "YEARLY",
  },
];

const ORGANIZER_PLANS: CatalogPlan[] = [
  {
    slug: "organizer-free",
    role: "ORGANIZER",
    name: "Free Plan",
    amountInr: 0,
    billingNote: "Free",
    billingKind: "FREE",
  },
  {
    slug: "organizer-silver",
    role: "ORGANIZER",
    name: "Silver Plan",
    amountInr: 25000,
    billingNote: "per year",
    billingKind: "YEARLY",
  },
  {
    slug: "organizer-gold",
    role: "ORGANIZER",
    name: "Gold Plan",
    amountInr: 50000,
    billingNote: "per year",
    billingKind: "YEARLY",
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
  return null;
}

export function billingKindToPlanType(billingKind: BillingKind): "MONTHLY" | "YEARLY" | "QUARTERLY" {
  if (billingKind === "YEARLY") return "YEARLY";
  return "MONTHLY";
}
