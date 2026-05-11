"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExhibitorsHandler = getExhibitorsHandler;
exports.createExhibitorHandler = createExhibitorHandler;
exports.getExhibitorHandler = getExhibitorHandler;
exports.updateExhibitorHandler = updateExhibitorHandler;
exports.getExhibitorAnalyticsHandler = getExhibitorAnalyticsHandler;
exports.getExhibitorEventsHandler = getExhibitorEventsHandler;
exports.getExhibitorPromotionsMarketingHandler = getExhibitorPromotionsMarketingHandler;
exports.createExhibitorPromotionHandler = createExhibitorPromotionHandler;
exports.getExhibitorLeadsCountHandler = getExhibitorLeadsCountHandler;
exports.getExhibitorReviewsHandler = getExhibitorReviewsHandler;
exports.createExhibitorReviewHandler = createExhibitorReviewHandler;
exports.createExhibitorReviewReplyHandler = createExhibitorReviewReplyHandler;
exports.getExhibitorProductsHandler = getExhibitorProductsHandler;
exports.createExhibitorProductHandler = createExhibitorProductHandler;
exports.updateExhibitorProductHandler = updateExhibitorProductHandler;
exports.deleteExhibitorProductHandler = deleteExhibitorProductHandler;
const exhibitors_service_1 = require("./exhibitors.service");
async function getExhibitorsHandler(_req, res) {
    try {
        const exhibitors = await (0, exhibitors_service_1.listExhibitors)();
        return res.json({ exhibitors });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitors (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function createExhibitorHandler(req, res) {
    try {
        const result = await (0, exhibitors_service_1.createExhibitor)(req.body ?? {});
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
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating exhibitor (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getExhibitorHandler(req, res) {
    try {
        const { id } = req.params;
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const exhibitor = await (0, exhibitors_service_1.getExhibitorById)(id, viewerId);
        if (!exhibitor) {
            return res.status(404).json({ success: false, error: "Exhibitor not found" });
        }
        return res.json({ success: true, exhibitor });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("Invalid exhibitor ID")) {
            return res.status(400).json({ success: false, error: "Invalid exhibitor ID" });
        }
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitor (backend):", error);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
}
async function updateExhibitorHandler(req, res) {
    try {
        const { id } = req.params;
        const updated = await (0, exhibitors_service_1.updateExhibitorProfile)(id, req.body ?? {});
        if (!updated) {
            return res.status(404).json({ success: false, error: "Exhibitor not found" });
        }
        return res.json({ success: true, exhibitor: updated });
    }
    catch (error) {
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
async function getExhibitorAnalyticsHandler(req, res) {
    try {
        const { id } = req.params;
        const analytics = await (0, exhibitors_service_1.getExhibitorAnalytics)(id);
        return res.json({
            success: true,
            analytics,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitor analytics (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getExhibitorEventsHandler(req, res) {
    try {
        const { exhibitorId } = req.params;
        if (!exhibitorId) {
            return res.status(400).json({ error: "exhibitorId is required" });
        }
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const events = await (0, exhibitors_service_1.getExhibitorEvents)(exhibitorId, viewerId);
        return res.status(200).json({ success: true, events });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("exhibitorId is required")) {
            return res.status(400).json({ error: "exhibitorId is required" });
        }
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitor events (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
/** Logged-in exhibitor: promotions + events for Promotions & Marketing dashboard. */
async function getExhibitorPromotionsMarketingHandler(req, res) {
    try {
        const exhibitorId = typeof req.query.exhibitorId === "string" ? req.query.exhibitorId.trim() : "";
        if (!exhibitorId) {
            return res.status(400).json({ error: "exhibitorId is required" });
        }
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        if (!viewerId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const data = await (0, exhibitors_service_1.getExhibitorPromotionsMarketingForSelf)(exhibitorId, viewerId);
        return res.status(200).json(data);
    }
    catch (error) {
        if (error instanceof Error && error.message === "FORBIDDEN") {
            return res.status(403).json({ error: "Forbidden" });
        }
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitor promotions marketing (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function createExhibitorPromotionHandler(req, res) {
    try {
        if (req.auth?.domain !== "USER" || !req.auth.sub) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const viewerUserId = req.auth.sub;
        const raw = req.body ?? {};
        const result = await (0, exhibitors_service_1.createExhibitorPromotionForSelf)(viewerUserId, {
            exhibitorId: typeof raw.exhibitorId === "string" ? raw.exhibitorId : "",
            eventId: typeof raw.eventId === "string" ? raw.eventId : "",
            packageType: typeof raw.packageType === "string" ? raw.packageType : "",
            targetCategories: Array.isArray(raw.targetCategories) ? raw.targetCategories : [],
            amount: Number(raw.amount),
            duration: Number(raw.duration),
        });
        if ("error" in result) {
            if (result.error === "FORBIDDEN") {
                return res.status(403).json({ error: "Forbidden" });
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
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating exhibitor promotion (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getExhibitorLeadsCountHandler(req, res) {
    try {
        const exhibitorId = req.params.id;
        if (!exhibitorId) {
            return res.status(400).json({ error: "exhibitor id is required" });
        }
        const count = await (0, exhibitors_service_1.getExhibitorLeadsCount)(exhibitorId);
        return res.json({ count, totalLeads: count });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitor leads count (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function getExhibitorReviewsHandler(req, res) {
    try {
        const exhibitorId = req.params.id ?? req.params.exhibitorId;
        if (!exhibitorId) {
            return res.status(400).json({ error: "exhibitorId is required" });
        }
        const reviews = await (0, exhibitors_service_1.listExhibitorReviews)(exhibitorId);
        return res.status(200).json({ reviews });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitor reviews (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function createExhibitorReviewHandler(req, res) {
    try {
        const exhibitorId = req.params.id ?? req.params.exhibitorId;
        if (!exhibitorId) {
            return res.status(400).json({ error: "exhibitorId is required" });
        }
        const userId = req.auth?.sub ?? req.user?.id;
        const review = await (0, exhibitors_service_1.createExhibitorReview)(exhibitorId, req.body ?? {}, userId);
        return res.status(201).json(review);
    }
    catch (error) {
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
async function createExhibitorReviewReplyHandler(req, res) {
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
        const reply = await (0, exhibitors_service_1.addExhibitorReviewReply)(exhibitorId, reviewId, req.body ?? {}, userId);
        return res.status(201).json(reply);
    }
    catch (error) {
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
async function getExhibitorProductsHandler(req, res) {
    try {
        const exhibitorId = req.params.id ?? req.params.exhibitorId;
        if (!exhibitorId) {
            return res.status(400).json({ error: "exhibitorId is required" });
        }
        const products = await (0, exhibitors_service_1.listExhibitorProducts)(exhibitorId);
        return res.status(200).json({ products });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching exhibitor products (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function createExhibitorProductHandler(req, res) {
    try {
        const exhibitorId = req.params.id ?? req.params.exhibitorId;
        if (!exhibitorId) {
            return res.status(400).json({ error: "exhibitorId is required" });
        }
        const product = await (0, exhibitors_service_1.createExhibitorProduct)(exhibitorId, req.body ?? {});
        return res.status(201).json({ product });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating exhibitor product (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function updateExhibitorProductHandler(req, res) {
    try {
        const exhibitorId = req.params.id ?? req.params.exhibitorId;
        const productId = req.params.productId;
        if (!exhibitorId || !productId) {
            return res.status(400).json({ error: "exhibitorId and productId are required" });
        }
        const product = await (0, exhibitors_service_1.updateExhibitorProduct)(exhibitorId, productId, req.body ?? {});
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        return res.status(200).json({ product });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error updating exhibitor product (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
async function deleteExhibitorProductHandler(req, res) {
    try {
        const exhibitorId = req.params.id ?? req.params.exhibitorId;
        const productId = req.params.productId;
        if (!exhibitorId || !productId) {
            return res.status(400).json({ error: "exhibitorId and productId are required" });
        }
        const deleted = await (0, exhibitors_service_1.deleteExhibitorProduct)(exhibitorId, productId);
        if (!deleted) {
            return res.status(404).json({ error: "Product not found" });
        }
        return res.status(200).json({ message: "Product deleted successfully" });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error deleting exhibitor product (backend):", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
