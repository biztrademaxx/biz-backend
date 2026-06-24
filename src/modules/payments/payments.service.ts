import prisma from "../../config/prisma";
import type { PaymentTransaction } from "@prisma/client";
import { createRazorpayOrder, verifyRazorpayPaymentSignature } from "./razorpay.service";

const MIN_AMOUNT_PAISE = 100;

export type PromotionPaymentChannel = "EVENT" | "ORGANIZER" | "EXHIBITOR";

export type CreatePromotionPaymentOrderInput = {
  userId: string;
  amountPaise: number;
  currency?: string;
  receipt: string;
  promotionChannel: PromotionPaymentChannel;
  eventId?: string | null;
  organizerId?: string | null;
  exhibitorId?: string | null;
  packageType: string;
  targetCategories: string[];
  durationDays: number;
  amountInr: number;
};

export async function createPromotionPaymentOrder(input: CreatePromotionPaymentOrderInput) {
  if (!Number.isFinite(input.amountPaise) || input.amountPaise < MIN_AMOUNT_PAISE) {
    return { error: "INVALID_AMOUNT" as const, message: `Amount must be at least ${MIN_AMOUNT_PAISE} paise` };
  }

  if (!input.packageType?.trim() || !Number.isFinite(input.durationDays) || input.durationDays <= 0) {
    return { error: "INVALID_CONTEXT" as const, message: "Invalid promotion package context" };
  }

  const razorpay = await createRazorpayOrder({
    amount: input.amountPaise,
    currency: input.currency ?? "INR",
    receipt: input.receipt,
  });

  if (!razorpay.ok) {
    return { error: "GATEWAY" as const, status: razorpay.status, message: razorpay.message };
  }

  const record = await prisma.paymentTransaction.create({
    data: {
      userId: input.userId,
      razorpayOrderId: razorpay.orderId,
      amountPaise: razorpay.amount,
      currency: razorpay.currency,
      receipt: input.receipt,
      promotionChannel: input.promotionChannel,
      eventId: input.eventId ?? null,
      organizerId: input.organizerId ?? null,
      exhibitorId: input.exhibitorId ?? null,
      packageType: input.packageType,
      targetCategories: input.targetCategories,
      durationDays: input.durationDays,
      amountInr: input.amountInr,
      status: "CREATED",
    },
  });

  return {
    order_id: razorpay.orderId,
    amount: razorpay.amount,
    currency: razorpay.currency,
    payment_transaction_id: record.id,
  };
}

export async function verifyPromotionPayment(input: {
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const verify = verifyRazorpayPaymentSignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });

  if (!verify.ok) {
    return { error: "VERIFY" as const, status: verify.status, message: verify.message };
  }

  const existing = await prisma.paymentTransaction.findUnique({
    where: { razorpayOrderId: input.razorpayOrderId },
  });

  if (!existing) {
    return { error: "NOT_FOUND" as const, message: "Payment order not found" };
  }

  if (existing.userId !== input.userId) {
    return { error: "FORBIDDEN" as const, message: "Payment does not belong to this user" };
  }

  if (existing.status === "CONSUMED") {
    return {
      success: true,
      payment_transaction_id: existing.id,
      razorpay_order_id: existing.razorpayOrderId,
      razorpay_payment_id: existing.razorpayPaymentId,
      already_consumed: true,
    };
  }

  if (existing.status !== "PAID" && existing.status !== "CREATED") {
    return { error: "INVALID_STATE" as const, message: "Payment is not in a payable state" };
  }

  const updated = await prisma.paymentTransaction.update({
    where: { id: existing.id },
    data: {
      status: "PAID",
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
      paidAt: new Date(),
    },
  });

  return {
    success: true,
    payment_transaction_id: updated.id,
    razorpay_order_id: updated.razorpayOrderId,
    razorpay_payment_id: updated.razorpayPaymentId,
    already_consumed: false,
  };
}

export type PromotionPaymentExpectation = {
  channel: PromotionPaymentChannel;
  eventId?: string | null;
  organizerId?: string | null;
  exhibitorId?: string | null;
};

export async function loadPaidPromotionPayment(
  paymentTransactionId: string,
  userId: string,
  expected: PromotionPaymentExpectation,
): Promise<PaymentTransaction | { error: string; status: number }> {
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTransactionId },
  });

  if (!payment) {
    return { error: "Payment not found", status: 404 };
  }

  if (payment.userId !== userId) {
    return { error: "Payment does not belong to this user", status: 403 };
  }

  if (payment.status !== "PAID") {
    return { error: "Payment has not been completed", status: 402 };
  }

  if (payment.promotionId) {
    return { error: "Payment has already been used for a promotion", status: 409 };
  }

  if (payment.promotionChannel !== expected.channel) {
    return { error: "Payment channel mismatch", status: 400 };
  }

  if (expected.eventId && payment.eventId !== expected.eventId) {
    return { error: "Payment event mismatch", status: 400 };
  }

  // Optional IDs: only enforce when stored on the payment record at checkout time.
  if (
    expected.organizerId &&
    payment.organizerId &&
    payment.organizerId !== expected.organizerId
  ) {
    return { error: "Payment organizer mismatch", status: 400 };
  }

  if (
    expected.exhibitorId &&
    payment.exhibitorId &&
    payment.exhibitorId !== expected.exhibitorId
  ) {
    return { error: "Payment exhibitor mismatch", status: 400 };
  }

  return payment;
}

export async function linkPaymentToPromotion(paymentTransactionId: string, promotionId: string) {
  await prisma.paymentTransaction.update({
    where: { id: paymentTransactionId },
    data: {
      promotionId,
      status: "CONSUMED",
    },
  });
}
