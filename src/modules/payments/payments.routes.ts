import { Router } from "express";
import { requireUser } from "../../middleware/auth.middleware";
import { createRazorpayOrderHandler, verifyRazorpayPaymentHandler } from "./payments.controller";

const router = Router();

router.post("/payments/razorpay/create-order", requireUser, createRazorpayOrderHandler);
router.post("/payments/razorpay/verify-payment", requireUser, verifyRazorpayPaymentHandler);

// Aliases for Next.js proxy (same handlers, auth required)
router.post("/create-order", requireUser, createRazorpayOrderHandler);
router.post("/verify-payment", requireUser, verifyRazorpayPaymentHandler);

export default router;
