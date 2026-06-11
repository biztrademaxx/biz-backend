import { Request, Response } from "express";
import {
  listOrganizers,
  listOrganizerFilterFacets,
  getOrganizerById,
  getOrganizerAnalytics,
  getOrganizerTotalAttendees,
  listOrganizerEvents,
  listOrganizerLeads,
  listOrganizerLeadsByType,
  listOrganizerPromotions,
  getOrganizerPromotionsMarketing,
  createOrganizerPromotion,
  getOrganizerSubscriptionSummary,
  updateOrganizerSubscriptionSummary,
  listOrganizerReviews,
  createOrganizerReview,
  listOrganizerMessages,
  createOrganizerMessage,
  deleteOrganizerMessage,
  updateOrganizerProfile,
  listOrganizerConnections,
} from "./organizers.service";
import prisma from "../../config/prisma";
import { updateEventByOrganizer, deleteEventByOrganizer } from "../events/events.service";
import { createEventAdmin } from "../events/events-writes.service";

export async function getOrganizerFacetsHandler(_req: Request, res: Response) {
  try {
    const facets = await listOrganizerFilterFacets();
    return res.json(facets);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer facets (backend):", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getOrganizersHandler(req: Request, res: Response) {
  try {
    const requireProfileImage =
      req.query.requireProfileImage === "1" || req.query.requireProfileImage === "true";
    const paginate = req.query.page != null || req.query.limit != null;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const city = typeof req.query.city === "string" ? req.query.city : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const eventsBucket =
      typeof req.query.eventsBucket === "string" ? req.query.eventsBucket : undefined;
    const followersBucket =
      typeof req.query.followersBucket === "string" ? req.query.followersBucket : undefined;
    const prioritizeCountry =
      typeof req.query.prioritizeCountry === "string" ? req.query.prioritizeCountry : undefined;
    const prioritizeCountryCode =
      typeof req.query.prioritizeCountryCode === "string"
        ? req.query.prioritizeCountryCode
        : undefined;
    const prioritizeCity =
      typeof req.query.prioritizeCity === "string" ? req.query.prioritizeCity : undefined;

    const result = await listOrganizers({
      requireProfileImage,
      paginate,
      page,
      limit,
      search,
      country,
      city,
      category,
      eventsBucket,
      followersBucket,
      prioritizeCountry,
      prioritizeCountryCode,
      prioritizeCity,
    });
    return res.json({
      organizers: result.organizers,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizers (backend):", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getOrganizerHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
    const organizer = await getOrganizerById(id, viewerId);

    if (!organizer) {
      // Expired JWT + private/inactive profile looks like 404; apiFetch only retries on 401.
      if (req.hadInvalidAuthToken) {
        const row = await prisma.user.findFirst({
          where: { id, role: "ORGANIZER" },
          select: { profileVisibility: true, isActive: true, isVerified: true },
        });
        if (row && (!row.isActive || row.profileVisibility === "private" || !row.isVerified)) {
          return res.status(401).json({ message: "Invalid or expired token" });
        }
      }
      return res.status(404).json({ error: "Organizer not found" });
    }

    return res.json({ organizer });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateOrganizerProfileHandler(req: Request, res: Response) {
  try {
    const auth = req.auth;
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid organizer ID" });
    }

    if (!auth || (auth.sub !== id && auth.role !== "ORGANIZER")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updated = await updateOrganizerProfile(id, req.body ?? {});

    if (!updated) {
      return res.status(404).json({ error: "Organizer not found" });
    }

    return res.json({ organizer: updated });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error updating organizer (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getOrganizerAnalyticsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const analytics = await getOrganizerAnalytics(id);

    if (!analytics) {
      return res.status(404).json({ error: "Organizer not found" });
    }

    return res.json({ analytics });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer analytics (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getOrganizerTotalAttendeesHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await getOrganizerTotalAttendees(id);

    return res.json(data);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer total attendees (backend):", error);
    return res.status(500).json({
      error: "Failed to fetch total attendees",
      details: error.message,
    });
  }
}

export async function getOrganizerEventsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;

    const result = await listOrganizerEvents(id, page, limit, viewerId);

    // Same as getOrganizer: owner with expired token would get an empty list without a chance to refresh.
    if (
      req.hadInvalidAuthToken &&
      result.events.length === 0 &&
      result.pagination.total === 0
    ) {
      const row = await prisma.user.findFirst({
        where: { id, role: "ORGANIZER" },
        select: { profileVisibility: true, isActive: true },
      });
      if (row && (!row.isActive || row.profileVisibility === "private")) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
    }

    return res.json({
      success: true,
      events: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer events (backend):", error);
    if (error instanceof Error && error.message.includes("Organizer ID is required")) {
      return res.status(400).json({ success: false, error: "Organizer ID is required" });
    }
    return res.status(500).json({ success: false, error: "Failed to fetch organizer events" });
  }
}

export async function updateOrganizerEventHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { id, eventId } = req.params;
    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid organizer ID" });
    }
    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required" });
    }
    if (auth.sub !== id && auth.role !== "ORGANIZER") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const result = await updateEventByOrganizer(id, eventId, req.body);
    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({ error: "Event not found or access denied" });
    }
    return res.status(200).json({
      message: "Event updated successfully",
      event: result.event,
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Update organizer event error (backend):", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteOrganizerEventHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { id, eventId } = req.params;
    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid organizer ID" });
    }
    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required" });
    }
    if (auth.sub !== id && auth.role !== "ORGANIZER") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const result = await deleteEventByOrganizer(id, eventId);
    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({ error: "Event not found or access denied" });
    }
    return res.status(200).json({ message: "Event deleted successfully" });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Delete organizer event error (backend):", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createOrganizerEventHandler(req: Request, res: Response) {
  try {
    const auth = req.auth;
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid organizer ID" });
    }

    // When called from the organizer Next.js dashboard we may not have
    // backend JWT auth (req.auth undefined). In that case, allow the
    // organizer to submit an event for approval based solely on the
    // path param id and rely on the admin approval flow to gate publish.
    if (auth && (auth.sub !== id || auth.role !== "ORGANIZER")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = {
      ...req.body,
      organizerId: id,
      status: "PENDING_APPROVAL",
    };

    const result = await createEventAdmin({
      body,
      adminId: auth?.sub ?? id,
      adminType: auth?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "SUB_ADMIN",
      ipAddress: (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    if ("error" in result) {
      if (result.error === "MISSING_FIELDS") {
        return res.status(400).json({
          error: `Missing required fields: ${(result.missing ?? []).join(", ")}`,
        });
      }
      if (result.error === "ORGANIZER_REQUIRED") {
        return res.status(400).json({
          error: "organizerId or organizerEmail/organizerName is required",
        });
      }
      return res.status(400).json({ error: "Bad request" });
    }

    return res.status(201).json({
      success: result.success,
      message: result.message,
      event: result.event,
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Create organizer event error (backend):", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ---------- Organizer messages ----------

export async function getOrganizerMessagesHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await listOrganizerMessages(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Organizer not found",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer messages (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch organizer messages",
      details: error.message,
    });
  }
}

export async function createOrganizerMessageHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({
        success: false,
        error: "Invalid organizer ID",
      });
    }

    if (auth.sub !== id && auth.role !== "ORGANIZER") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const body = req.body as {
      subject?: string;
      content: string;
      contactId?: string;
    };

    if (!body.content || typeof body.content !== "string") {
      return res.status(400).json({
        success: false,
        error: "Message content is required",
      });
    }

    const result = await createOrganizerMessage(id, body);

    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "Organizer not found",
      });
    }

    return res.status(201).json({
      success: true,
      data: result.message,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error creating organizer message (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create message",
      details: error.message,
    });
  }
}

export async function deleteOrganizerMessageHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { id, messageId } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({
        success: false,
        error: "Invalid organizer ID",
      });
    }

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    if (auth.sub !== id && auth.role !== "ORGANIZER") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const result = await deleteOrganizerMessage(id, messageId);

    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "Organizer not found",
      });
    }

    return res.json({
      success: true,
      data: {
        deleted: true,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error deleting organizer message (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete message",
      details: error.message,
    });
  }
}

// ---------- Organizer connections ----------

export async function getOrganizerConnectionsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const auth = req.auth;

    if (!id || id === "undefined") {
      return res.status(400).json({
        success: false,
        error: "Invalid organizer ID",
      });
    }

    if (!auth || (auth.sub !== id && auth.role !== "ORGANIZER")) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const connections = await listOrganizerConnections(id);

    return res.json({
      success: true,
      connections,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer connections (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch connections",
      details: error.message,
    });
  }
}

// ---------- Organizer leads ----------

export async function getOrganizerLeadsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await listOrganizerLeads(id);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer leads (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch organizer leads",
      details: error.message,
    });
  }
}

export async function getOrganizerExhibitorLeadsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await listOrganizerLeadsByType(id, "EXHIBITOR");

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer exhibitor leads (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch exhibitor leads",
      details: error.message,
    });
  }
}

export async function getOrganizerAttendeeLeadsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await listOrganizerLeadsByType(id, "ATTENDEE");

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer attendee leads (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch attendee leads",
      details: error.message,
    });
  }
}

// ---------- Organizer promotions ----------

export async function getOrganizerPromotionsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await getOrganizerPromotionsMarketing(id);

    return res.json(data);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer promotions (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch promotions",
      details: error.message,
    });
  }
}

export async function createOrganizerPromotionHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({
        success: false,
        error: "Invalid organizer ID",
      });
    }

    if (auth.sub !== id && auth.role !== "ORGANIZER") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const body = req.body as {
      eventId?: string | null;
      packageType?: string;
      targetCategories?: string[];
      amount?: number;
      duration?: number;
    };

    const result = await createOrganizerPromotion(id, body);

    if ("error" in result) {
      if (result.error === "EVENT_REQUIRED") {
        return res.status(400).json({
          success: false,
          error: "eventId is required",
        });
      }
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error: "Event not found or access denied",
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: result.promotion,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error creating organizer promotion (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create promotion",
      details: error.message,
    });
  }
}

// ---------- Organizer subscription ----------

export async function getOrganizerSubscriptionHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const summary = await getOrganizerSubscriptionSummary(id);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: "Organizer not found",
      });
    }

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer subscription (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch subscription",
      details: error.message,
    });
  }
}

export async function updateOrganizerSubscriptionHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({
        success: false,
        error: "Invalid organizer ID",
      });
    }

    if (auth.sub !== id && auth.role !== "ORGANIZER") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const body = req.body as { planType?: string; status?: string };
    const updated = await updateOrganizerSubscriptionSummary(id, body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Organizer not found",
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error updating organizer subscription (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update subscription",
      details: error.message,
    });
  }
}

// ---------- Organizer reviews ----------

export async function getOrganizerReviewsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const organizerProfile = await getOrganizerById(id, undefined);
    if (!organizerProfile) {
      return res.status(404).json({ success: false, error: "Organizer not found" });
    }
    const includeReplies = req.query.includeReplies === "true";
    const reviews = await listOrganizerReviews(id, { includeReplies });

    const organizer = await prisma.user.findFirst({
      where: { id: organizerProfile.id, role: "ORGANIZER" },
      select: {
        id: true,
        averageRating: true,
        totalReviews: true,
        organizationName: true,
        firstName: true,
        lastName: true,
      },
    });

    const payload: { success: true; reviews: any[]; data?: { reviews: any[] }; organizer?: any } = {
      success: true,
      reviews,
    };
    payload.data = { reviews };
    if (organizer) {
      payload.organizer = {
        id: organizer.id,
        name: organizer.organizationName || `${organizer.firstName ?? ""} ${organizer.lastName ?? ""}`.trim(),
        averageRating: organizer.averageRating ?? 0,
        totalReviews: organizer.totalReviews ?? 0,
      };
    }

    return res.json(payload);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching organizer reviews (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch reviews",
      details: error.message,
    });
  }
}

export async function createOrganizerReviewHandler(req: Request, res: Response) {
  try {
    const { id: organizerIdentifier } = req.params;
    const userId = req.auth?.sub;
    const { rating, comment, title } = req.body ?? {};

    if (!organizerIdentifier) {
      return res.status(400).json({ success: false, error: "Invalid organizer ID" });
    }
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required to submit a review" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: "Rating must be between 1 and 5" });
    }
    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ success: false, error: "Comment is required" });
    }

    const organizerProfile = await getOrganizerById(organizerIdentifier, undefined);
    if (!organizerProfile) {
      return res.status(404).json({ success: false, error: "Organizer not found" });
    }

    const review = await createOrganizerReview({
      organizerId: organizerProfile.id,
      userId,
      rating: Number(rating),
      comment: String(comment).trim(),
      title: title ?? undefined,
    });

    return res.status(201).json(review);
  } catch (error: any) {
    if (error?.message?.includes("already reviewed")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error?.message?.includes("not found")) {
      return res.status(404).json({ success: false, error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error("Error creating organizer review (backend):", error);
    return res.status(500).json({ success: false, error: "Failed to create review" });
  }
}

