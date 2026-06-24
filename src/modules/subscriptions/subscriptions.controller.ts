import type { Request, Response } from "express";
import {
  activateFreePlan,
  activateSubscriptionAfterPayment,
  createSubscriptionPaymentOrder,
  getCurrentPlanForRole,
} from "./subscriptions.service";

export async function createSubscriptionOrderHandler(req: Request, res: Response) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const role = String(req.body?.role ?? "").trim();
    const planSlug = String(req.body?.planSlug ?? req.body?.planId ?? "").trim();
    const receipt = typeof req.body?.receipt === "string" ? req.body.receipt : undefined;

    if (!role || !planSlug) {
      return res.status(400).json({ message: "role and planSlug are required" });
    }

    const result = await createSubscriptionPaymentOrder({ userId, role, planSlug, receipt });

    if ("error" in result) {
      const status =
        result.error === "GATEWAY"
          ? result.status
          : result.error === "FREE_PLAN"
            ? 400
            : 400;
      return res.status(status).json({ message: result.message });
    }

    return res.json(result);
  } catch (error) {
    console.error("createSubscriptionOrderHandler:", error);
    return res.status(500).json({ message: "Failed to create subscription order" });
  }
}

export async function activateSubscriptionHandler(req: Request, res: Response) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const paymentTransactionId = String(
      req.body?.paymentTransactionId ?? req.body?.payment_transaction_id ?? "",
    ).trim();

    if (!paymentTransactionId) {
      return res.status(400).json({ message: "paymentTransactionId is required" });
    }

    const result = await activateSubscriptionAfterPayment({ userId, paymentTransactionId });

    if ("error" in result) {
      return res.status(result.status ?? 400).json({ message: result.message });
    }

    return res.json(result);
  } catch (error) {
    console.error("activateSubscriptionHandler:", error);
    return res.status(500).json({ message: "Failed to activate subscription" });
  }
}

export async function activateFreePlanHandler(req: Request, res: Response) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const role = String(req.body?.role ?? "").trim();
    const planSlug = String(req.body?.planSlug ?? req.body?.planId ?? "").trim();

    if (!role || !planSlug) {
      return res.status(400).json({ message: "role and planSlug are required" });
    }

    const result = await activateFreePlan({ userId, role, planSlug });

    if ("error" in result) {
      return res.status(400).json({ message: result.message });
    }

    return res.json(result);
  } catch (error) {
    console.error("activateFreePlanHandler:", error);
    return res.status(500).json({ message: "Failed to activate free plan" });
  }
}

export async function getCurrentPlanHandler(req: Request, res: Response) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const role = String(req.query?.role ?? "").trim();
    if (!role) {
      return res.status(400).json({ message: "role query parameter is required" });
    }

    const result = await getCurrentPlanForRole(userId, role);

    if ("error" in result) {
      return res.status(400).json({ message: result.message });
    }

    return res.json(result);
  } catch (error) {
    console.error("getCurrentPlanHandler:", error);
    return res.status(500).json({ message: "Failed to load current plan" });
  }
}
