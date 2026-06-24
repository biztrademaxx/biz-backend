import type { Request, Response } from "express";
import {
  createPromotionPaymentOrder,
  verifyPromotionPayment,
} from "./payments.service";

export async function createRazorpayOrderHandler(req: Request, res: Response) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const amount = Number(req.body?.amount);
    const currency = typeof req.body?.currency === "string" ? req.body.currency : "INR";
    const receipt =
      typeof req.body?.receipt === "string" && req.body.receipt.trim()
        ? req.body.receipt.trim()
        : `rcpt_${Date.now()}`;

    const promotionChannel = req.body?.promotionChannel;
    if (!["EVENT", "ORGANIZER", "EXHIBITOR"].includes(promotionChannel)) {
      return res.status(400).json({ message: "promotionChannel must be EVENT, ORGANIZER, or EXHIBITOR" });
    }

    const packageType = String(req.body?.packageType ?? "").trim();
    const targetCategories = Array.isArray(req.body?.targetCategories)
      ? req.body.targetCategories.map(String)
      : [];
    const durationDays = Number(req.body?.durationDays);
    const amountInr = Number(req.body?.amountInr);

    const result = await createPromotionPaymentOrder({
      userId,
      amountPaise: amount,
      currency,
      receipt,
      promotionChannel,
      eventId: req.body?.eventId ?? null,
      organizerId: req.body?.organizerId ?? null,
      exhibitorId: req.body?.exhibitorId ?? null,
      packageType,
      targetCategories,
      durationDays,
      amountInr,
    });

    if ("error" in result) {
      const status = result.error === "GATEWAY" ? result.status : 400;
      return res.status(status).json({ message: result.message });
    }

    return res.json(result);
  } catch (error) {
    console.error("createRazorpayOrderHandler:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
}

export async function verifyRazorpayPaymentHandler(req: Request, res: Response) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const razorpay_order_id =
      req.body?.razorpay_order_id ?? req.body?.order_id ?? req.body?.orderId;
    const razorpay_payment_id =
      req.body?.razorpay_payment_id ?? req.body?.payment_id ?? req.body?.paymentId;
    const razorpay_signature = req.body?.razorpay_signature ?? req.body?.signature;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature",
      });
    }

    const result = await verifyPromotionPayment({
      userId,
      razorpayOrderId: String(razorpay_order_id),
      razorpayPaymentId: String(razorpay_payment_id),
      razorpaySignature: String(razorpay_signature),
    });

    if ("error" in result) {
      const status =
        result.error === "VERIFY"
          ? result.status
          : result.error === "FORBIDDEN"
            ? 403
            : result.error === "NOT_FOUND"
              ? 404
              : 400;
      return res.status(status).json({ success: false, message: result.message });
    }

    return res.json(result);
  } catch (error) {
    console.error("verifyRazorpayPaymentHandler:", error);
    return res.status(500).json({ success: false, message: "Payment verification failed" });
  }
}
