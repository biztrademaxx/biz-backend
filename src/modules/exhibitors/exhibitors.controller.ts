import { Request, Response } from "express";
import {
  listExhibitors,
  getExhibitorById,
  updateExhibitorProfile,
  getExhibitorAnalytics,
  getExhibitorEvents,
  getExhibitorPromotionsMarketingForSelf,
  createExhibitorPromotionForSelf,
  createExhibitor,
  listExhibitorReviews,
  createExhibitorReview,
  addExhibitorReviewReply,
  getExhibitorLeadsCount,
  listExhibitorProducts,
  createExhibitorProduct,
  updateExhibitorProduct,
  deleteExhibitorProduct,
} from "./exhibitors.service";

/**
 * JWT `sub` to pass into exhibitor slug resolution (“view my profile by slug”).
 * - Admin portal tokens (`domain === "ADMIN"`) must not be used (wrong id space).
 * - Legacy app tokens may omit `domain`; treat like end-user as long as not admin.
 */
function exhibitorResolutionViewerId(req: Request): string | undefined {
  const sub = req.auth?.sub;
  if (!sub || sub === "internal") return undefined;
  if (req.auth?.domain === "ADMIN") return undefined;
  return sub;
}

export async function getExhibitorsHandler(_req: Request, res: Response) {
  try {
    const exhibitors = await listExhibitors();
    return res.json({ exhibitors });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitors (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createExhibitorHandler(req: Request, res: Response) {
  try {
    const result = await createExhibitor(req.body ?? {});
    if ("error" in result) {
      if (result.error === "MISSING_FIELDS") {
        return res.status(400).json({
          error: "Missing required fields: firstName, lastName, email, company",
          missing: result.missing,
        });
      }
      if (result.error === "EMAIL_EXISTS") {
        return res.status(409).json({ error: "User with this email already exists" });
      }
      return res.status(400).json({ error: "Bad request" });
    }
    return res.status(201).json({ exhibitor: result.exhibitor });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error creating exhibitor (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getExhibitorHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const viewerId = exhibitorResolutionViewerId(req);
    const exhibitor = await getExhibitorById(id, viewerId, req.auth?.role);

    if (!exhibitor) {
      return res.status(404).json({ success: false, error: "Exhibitor not found" });
    }

    return res.json({ success: true, exhibitor });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("Invalid exhibitor ID")) {
      return res.status(400).json({ success: false, error: "Invalid exhibitor ID" });
    }
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitor (backend):", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function updateExhibitorHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const viewerId = exhibitorResolutionViewerId(req);
    const updated = await updateExhibitorProfile(id, req.body ?? {}, viewerId, req.auth?.role);

    if (!updated) {
      return res.status(404).json({ success: false, error: "Exhibitor not found" });
    }

    return res.json({ success: true, exhibitor: updated });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("Invalid exhibitor ID")) {
      return res.status(400).json({ success: false, error: "Invalid exhibitor ID" });
    }
    if (error instanceof Error && error.message.includes("Exhibitor not found")) {
      return res.status(404).json({ success: false, error: "Exhibitor not found" });
    }
    // eslint-disable-next-line no-console
    console.error("Error updating exhibitor (backend):", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getExhibitorAnalyticsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const analytics = await getExhibitorAnalytics(id);

    return res.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitor analytics (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getExhibitorEventsHandler(req: Request, res: Response) {
  try {
    const { exhibitorId } = req.params;
    if (!exhibitorId) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }

    const viewerId = exhibitorResolutionViewerId(req);
    const events = await getExhibitorEvents(exhibitorId, viewerId, req.auth?.role);
    return res.status(200).json({ success: true, events });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("exhibitorId is required")) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitor events (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** Logged-in exhibitor: promotions + events for Promotions & Marketing dashboard. */
export async function getExhibitorPromotionsMarketingHandler(req: Request, res: Response) {
  try {
    const exhibitorId = typeof req.query.exhibitorId === "string" ? req.query.exhibitorId.trim() : "";
    if (!exhibitorId) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }
    const viewerId = exhibitorResolutionViewerId(req);
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const data = await getExhibitorPromotionsMarketingForSelf(exhibitorId, viewerId);
    return res.status(200).json(data);
  } catch (error: any) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitor promotions marketing (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createExhibitorPromotionHandler(req: Request, res: Response) {
  try {
    if (req.auth?.domain !== "USER" || !req.auth.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const viewerUserId = req.auth.sub;
    const raw = req.body ?? {};
    const result = await createExhibitorPromotionForSelf(viewerUserId, {
      exhibitorId: typeof raw.exhibitorId === "string" ? raw.exhibitorId : "",
      paymentTransactionId:
        typeof raw.paymentTransactionId === "string" ? raw.paymentTransactionId : "",
    });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (result.error === "PAYMENT_REQUIRED") {
        return res.status(402).json({ error: "Verified payment is required" });
      }
      if (result.error === "PAYMENT_INVALID") {
        return res.status(result.status ?? 402).json({ error: result.message });
      }
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Event not found" });
      }
      if (result.error === "NOT_BOOTH") {
        return res.status(403).json({ error: "No booth booking for this event" });
      }
      return res.status(400).json({ error: "Missing or invalid fields" });
    }
    return res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      promotion: result.promotion,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error creating exhibitor promotion (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getExhibitorLeadsCountHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id;
    if (!exhibitorId) {
      return res.status(400).json({ error: "exhibitor id is required" });
    }
    const count = await getExhibitorLeadsCount(exhibitorId);
    return res.json({ count, totalLeads: count });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitor leads count (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getExhibitorReviewsHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id ?? req.params.exhibitorId;
    if (!exhibitorId) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }
    const reviews = await listExhibitorReviews(exhibitorId);
    return res.status(200).json({ reviews });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitor reviews (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createExhibitorReviewHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id ?? req.params.exhibitorId;
    if (!exhibitorId) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }
    const userId = req.auth?.sub ?? (req as any).user?.id;
    const review = await createExhibitorReview(exhibitorId, req.body ?? {}, userId);
    return res.status(201).json(review);
  } catch (error: any) {
    if (error instanceof Error && error.message === "Exhibitor not found") {
      return res.status(404).json({ error: "Exhibitor not found" });
    }
    if (error instanceof Error && error.message.includes("exhibitorId is required")) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }
    // eslint-disable-next-line no-console
    console.error("Error creating exhibitor review (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createExhibitorReviewReplyHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id ?? req.params.exhibitorId;
    const reviewId = req.params.reviewId;
    const userId = req.auth?.sub;
    if (!exhibitorId || !reviewId) {
      return res.status(400).json({ error: "exhibitorId and reviewId are required" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const reply = await addExhibitorReviewReply(
      exhibitorId,
      reviewId,
      req.body ?? {},
      userId
    );
    return res.status(201).json(reply);
  } catch (error: any) {
    if (error instanceof Error && error.message === "Exhibitor not found") {
      return res.status(404).json({ error: "Exhibitor not found" });
    }
    if (error instanceof Error && error.message === "Review not found") {
      return res.status(404).json({ error: "Review not found" });
    }
    // eslint-disable-next-line no-console
    console.error("Error creating exhibitor review reply (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getExhibitorProductsHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id ?? req.params.exhibitorId;
    if (!exhibitorId) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }
    const viewerId = exhibitorResolutionViewerId(req);
    const products = await listExhibitorProducts(exhibitorId, viewerId, req.auth?.role);
    return res.status(200).json({ products });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibitor products (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createExhibitorProductHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id ?? req.params.exhibitorId;
    if (!exhibitorId) {
      return res.status(400).json({ error: "exhibitorId is required" });
    }
    const viewerId = exhibitorResolutionViewerId(req);
    const product = await createExhibitorProduct(exhibitorId, req.body ?? {}, viewerId, req.auth?.role);
    return res.status(201).json({ product });
  } catch (error: any) {
    console.error("Error creating exhibitor product (backend):", error);
    const msg = error?.message ?? "Internal server error";
    if (msg === "Authentication required" || msg === "Access denied") {
      return res.status(403).json({ error: msg });
    }
    if (msg === "Product name is required" || msg === "exhibitorId is required") {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
}

export async function updateExhibitorProductHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id ?? req.params.exhibitorId;
    const productId = req.params.productId;
    if (!exhibitorId || !productId) {
      return res.status(400).json({ error: "exhibitorId and productId are required" });
    }
    const viewerId = exhibitorResolutionViewerId(req);
    const product = await updateExhibitorProduct(exhibitorId, productId, req.body ?? {}, viewerId, req.auth?.role);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.status(200).json({ product });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error updating exhibitor product (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteExhibitorProductHandler(req: Request, res: Response) {
  try {
    const exhibitorId = req.params.id ?? req.params.exhibitorId;
    const productId = req.params.productId;
    if (!exhibitorId || !productId) {
      return res.status(400).json({ error: "exhibitorId and productId are required" });
    }
    const viewerId = exhibitorResolutionViewerId(req);
    const deleted = await deleteExhibitorProduct(exhibitorId, productId, viewerId, req.auth?.role);
    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error deleting exhibitor product (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

