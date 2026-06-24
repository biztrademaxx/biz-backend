import prisma from "../../config/prisma";
import type { PaymentTransaction, UserPlanSubscription } from "@prisma/client";
import { createRazorpayOrder } from "../payments/razorpay.service";
import {
  computeExpiresAt,
  defaultFreePlanSlug,
  getCatalogPlan,
  type DashboardPlanRole,
} from "./plan-catalog";

const MIN_AMOUNT_PAISE = 100;

export async function createSubscriptionPaymentOrder(input: {
  userId: string;
  role: string;
  planSlug: string;
  receipt?: string;
}) {
  const plan = getCatalogPlan(input.role, input.planSlug);
  if (!plan) {
    return { error: "INVALID_PLAN" as const, message: "Unknown plan for this role" };
  }

  if (plan.billingKind === "FREE" || plan.amountInr <= 0) {
    return {
      error: "FREE_PLAN" as const,
      message: "This plan is free — use activate-free instead of payment",
    };
  }

  const amountPaise = Math.max(MIN_AMOUNT_PAISE, Math.round(plan.amountInr * 100));
  const receipt =
    input.receipt?.trim() || `sub_${plan.slug}_${Date.now().toString(36)}`;

  const razorpay = await createRazorpayOrder({
    amount: amountPaise,
    currency: "INR",
    receipt,
  });

  if (!razorpay.ok) {
    return { error: "GATEWAY" as const, status: razorpay.status, message: razorpay.message };
  }

  const record = await prisma.paymentTransaction.create({
    data: {
      userId: input.userId,
      purpose: "SUBSCRIPTION",
      razorpayOrderId: razorpay.orderId,
      amountPaise: razorpay.amount,
      currency: razorpay.currency,
      receipt,
      amountInr: plan.amountInr,
      subscriptionRole: plan.role,
      planSlug: plan.slug,
      planName: plan.name,
      billingNote: plan.billingNote,
      status: "CREATED",
    },
  });

  return {
    order_id: razorpay.orderId,
    amount: razorpay.amount,
    currency: razorpay.currency,
    payment_transaction_id: record.id,
    plan: {
      slug: plan.slug,
      name: plan.name,
      role: plan.role,
      amountInr: plan.amountInr,
      billingNote: plan.billingNote,
    },
  };
}

async function supersedeActiveSubscriptions(userId: string, role: string) {
  await prisma.userPlanSubscription.updateMany({
    where: { userId, role, status: "ACTIVE" },
    data: { status: "SUPERSEDED" },
  });
}

async function createSubscriptionRecord(input: {
  userId: string;
  planSlug: string;
  role: string;
  paymentTransactionId?: string | null;
}): Promise<UserPlanSubscription | { error: string; status: number }> {
  const plan = getCatalogPlan(input.role, input.planSlug);
  if (!plan) {
    return { error: "Unknown plan", status: 400 };
  }

  const startedAt = new Date();
  const expiresAt = computeExpiresAt(plan.billingKind, startedAt);

  await supersedeActiveSubscriptions(input.userId, plan.role);

  return prisma.userPlanSubscription.create({
    data: {
      userId: input.userId,
      role: plan.role,
      planSlug: plan.slug,
      planName: plan.name,
      billingNote: plan.billingNote,
      status: "ACTIVE",
      amountInr: plan.amountInr,
      startedAt,
      expiresAt,
      paymentTransactionId: input.paymentTransactionId ?? null,
    },
  });
}

export async function activateFreePlan(input: { userId: string; role: string; planSlug: string }) {
  const plan = getCatalogPlan(input.role, input.planSlug);
  if (!plan) {
    return { error: "INVALID_PLAN" as const, message: "Unknown plan for this role" };
  }

  if (plan.billingKind !== "FREE" || plan.amountInr > 0) {
    return { error: "PAID_PLAN" as const, message: "This plan requires payment" };
  }

  const subscription = await createSubscriptionRecord({
    userId: input.userId,
    role: plan.role,
    planSlug: plan.slug,
  });

  if ("error" in subscription) {
    return { error: "FAILED" as const, message: subscription.error };
  }

  return { success: true, subscription: serializeSubscription(subscription) };
}

export async function loadPaidSubscriptionPayment(
  paymentTransactionId: string,
  userId: string,
): Promise<PaymentTransaction | { error: string; status: number }> {
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTransactionId },
    include: { userPlanSubscription: true },
  });

  if (!payment) {
    return { error: "Payment not found", status: 404 };
  }

  if (payment.userId !== userId) {
    return { error: "Payment does not belong to this user", status: 403 };
  }

  if (payment.purpose !== "SUBSCRIPTION") {
    return { error: "Payment is not a subscription checkout", status: 400 };
  }

  if (payment.status !== "PAID") {
    return { error: "Payment has not been completed", status: 402 };
  }

  if (payment.userPlanSubscription) {
    return { error: "Payment has already been used for a subscription", status: 409 };
  }

  if (!payment.planSlug || !payment.subscriptionRole) {
    return { error: "Payment is missing plan metadata", status: 400 };
  }

  return payment;
}

export async function activateSubscriptionAfterPayment(input: {
  userId: string;
  paymentTransactionId: string;
}) {
  const payment = await loadPaidSubscriptionPayment(input.paymentTransactionId, input.userId);
  if ("error" in payment) {
    return { error: "INVALID_PAYMENT" as const, message: payment.error, status: payment.status };
  }

  const subscription = await prisma.$transaction(async (tx) => {
    await tx.userPlanSubscription.updateMany({
      where: { userId: input.userId, role: payment.subscriptionRole!, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });

    const startedAt = new Date();
    const plan = getCatalogPlan(payment.subscriptionRole!, payment.planSlug!);
    const expiresAt = plan ? computeExpiresAt(plan.billingKind, startedAt) : null;

    const sub = await tx.userPlanSubscription.create({
      data: {
        userId: input.userId,
        role: payment.subscriptionRole!,
        planSlug: payment.planSlug!,
        planName: payment.planName ?? payment.planSlug!,
        billingNote: payment.billingNote,
        status: "ACTIVE",
        amountInr: payment.amountInr,
        startedAt,
        expiresAt,
        paymentTransactionId: payment.id,
      },
    });

    await tx.paymentTransaction.update({
      where: { id: payment.id },
      data: { status: "CONSUMED" },
    });

    return sub;
  });

  return { success: true, subscription: serializeSubscription(subscription) };
}

function serializeSubscription(s: UserPlanSubscription) {
  return {
    id: s.id,
    role: s.role,
    planSlug: s.planSlug,
    planName: s.planName,
    billingNote: s.billingNote,
    status: s.status,
    amountInr: s.amountInr,
    startedAt: s.startedAt.toISOString(),
    expiresAt: s.expiresAt?.toISOString() ?? null,
    paymentTransactionId: s.paymentTransactionId,
  };
}

export async function getCurrentPlanForRole(userId: string, role: string) {
  const normalizedRole = role.toUpperCase() as DashboardPlanRole;
  if (!["VISITOR", "EXHIBITOR", "ORGANIZER"].includes(normalizedRole)) {
    return { error: "INVALID_ROLE" as const, message: "role must be VISITOR, EXHIBITOR, or ORGANIZER" };
  }

  let subscription = await prisma.userPlanSubscription.findFirst({
    where: { userId, role: normalizedRole, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: { paymentTransaction: true },
  });

  if (!subscription) {
    const freeSlug = defaultFreePlanSlug(normalizedRole);
    const plan = getCatalogPlan(normalizedRole, freeSlug);
    if (!plan) {
      return { planSlug: freeSlug, planName: "Free Plan", isDefault: true };
    }
    return {
      planSlug: plan.slug,
      planName: plan.name,
      billingNote: plan.billingNote,
      amountInr: 0,
      status: "ACTIVE",
      isDefault: true,
      startedAt: null,
      expiresAt: null,
      paymentTransactionId: null,
      razorpayPaymentId: null,
    };
  }

  if (subscription.expiresAt && subscription.expiresAt < new Date()) {
    await prisma.userPlanSubscription.update({
      where: { id: subscription.id },
      data: { status: "EXPIRED" },
    });
    const freeSlug = defaultFreePlanSlug(normalizedRole);
    const plan = getCatalogPlan(normalizedRole, freeSlug);
    return {
      planSlug: freeSlug,
      planName: plan?.name ?? "Free Plan",
      billingNote: plan?.billingNote ?? null,
      amountInr: 0,
      status: "ACTIVE",
      isDefault: true,
      startedAt: null,
      expiresAt: null,
      paymentTransactionId: null,
      razorpayPaymentId: null,
    };
  }

  return {
    planSlug: subscription.planSlug,
    planName: subscription.planName,
    billingNote: subscription.billingNote,
    amountInr: subscription.amountInr,
    status: subscription.status,
    isDefault: false,
    startedAt: subscription.startedAt.toISOString(),
    expiresAt: subscription.expiresAt?.toISOString() ?? null,
    paymentTransactionId: subscription.paymentTransactionId,
    razorpayPaymentId: subscription.paymentTransaction?.razorpayPaymentId ?? null,
    subscriptionId: subscription.id,
  };
}
