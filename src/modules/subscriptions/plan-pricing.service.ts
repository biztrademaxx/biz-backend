import prisma from "../../config/prisma";
import { getCatalogPlan, getPlansByRole, type CatalogPlan, type DashboardPlanRole } from "./plan-catalog";

export const MAX_PLAN_PRICE_INR = 10_000_000;
const priceKey = (slug: string) => `subscription-price:${slug}`;

export class PlanPriceError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function isValidPaidPlanPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 1 && value <= MAX_PLAN_PRICE_INR &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

function applyPrice(plan: CatalogPlan, value: unknown): CatalogPlan {
  if (plan.role !== "ORGANIZER" || plan.billingKind === "FREE" || value == null) return { ...plan };
  const amountInr = typeof value === "object" ? (value as { amountInr?: unknown }).amountInr : undefined;
  if (!isValidPaidPlanPrice(amountInr)) {
    throw new Error(`Invalid saved subscription price for ${plan.slug}`);
  }
  return { ...plan, amountInr: Math.round(amountInr * 100) / 100 };
}

export async function getPricedCatalogPlan(role: string, slug: string): Promise<CatalogPlan | null> {
  const plan = getCatalogPlan(role, slug);
  if (!plan) return null;
  if (plan.role !== "ORGANIZER" || plan.billingKind === "FREE") return { ...plan };
  const saved = await prisma.adminAppSetting.findUnique({ where: { key: priceKey(slug) } });
  return applyPrice(plan, saved?.value);
}

export async function listPricedCatalogPlans(role: DashboardPlanRole): Promise<CatalogPlan[]> {
  const plans = getPlansByRole(role);
  if (role !== "ORGANIZER") return plans.map((plan) => ({ ...plan }));
  const saved = await prisma.adminAppSetting.findMany({
    where: { key: { in: plans.filter((plan) => plan.billingKind !== "FREE").map((plan) => priceKey(plan.slug)) } },
    select: { key: true, value: true },
  });
  const values = new Map(saved.map((row) => [row.key, row.value]));
  return plans.map((plan) => applyPrice(plan, values.get(priceKey(plan.slug))));
}

export async function updateOrganizerPlanPrice(
  slug: string,
  amountInr: unknown,
  auth: { sub: string; role: string },
): Promise<CatalogPlan> {
  const plan = getCatalogPlan("ORGANIZER", slug);
  if (!plan) throw new PlanPriceError("Organizer plan not found", 404);
  if (plan.billingKind === "FREE") throw new PlanPriceError("The Free plan must remain ₹0.");
  if (!isValidPaidPlanPrice(amountInr)) {
    throw new PlanPriceError("Enter an INR amount from ₹1 to ₹1,00,00,000 with up to two decimal places.");
  }
  const normalizedAmount = Math.round(amountInr * 100) / 100;
  // Each plan has its own setting. Save its price and audit entry together.
  await prisma.$transaction(async (tx) => {
    const previous = await tx.adminAppSetting.findUnique({ where: { key: priceKey(slug) } });
    const previousAmount = applyPrice(plan, previous?.value).amountInr;
    await tx.adminAppSetting.upsert({
      where: { key: priceKey(slug) },
      create: { key: priceKey(slug), value: { amountInr: normalizedAmount } },
      update: { value: { amountInr: normalizedAmount } },
    });
    await tx.adminLog.create({
      data: {
        adminId: auth.sub,
        adminType: auth.role === "SUB_ADMIN" ? "SUB_ADMIN" : "SUPER_ADMIN",
        action: "UPDATE_SUBSCRIPTION_PRICE",
        resource: "subscription-plan",
        resourceId: slug,
        details: { previousAmountInr: previousAmount, amountInr: normalizedAmount, currency: "INR" },
      },
    });
  });
  return { ...plan, amountInr: normalizedAmount };
}
