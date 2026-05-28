import { Request, Response } from "express";
import {
  listEvents,
  getEventByIdentifier,
  getFeaturedEvents,
  getCategoryStats,
  getEventStats,
  searchEntities,
  saveEvent,
  unsaveEvent,
  isEventSaved,
  getEventPromotions,
  createPromotion,
  listRecentEvents,
  listVipEvents,
  listEventLeads,
  listEventAttendees,
  listEventExhibitors,
  listEventSpeakers,
  getEventBrochureAndDocuments,
  updateEventLayoutPlan,
  updateEventFields,
} from "./events.service";
import { updateEventSchedule } from "./event-schedule";
import {
  listEventSpaceCosts,
  listSpeakerSessions,
  createEventLead,
  listExhibitionSpaces,
  createExhibitionSpace,
  updateExhibitionSpace,
  addExhibitorToEvent,
  removeExhibitorFromEvent,
} from "./events.service";
import { createEventAdmin, createSpeakerSession } from "./events-writes.service";
import prisma from "../../config/prisma";
import {
  listActiveEventCategoriesPublic,
  listActiveEventCategoriesWithEventCounts,
} from "../admin/event-categories/event-categories.service";

/** Public list of active event categories (organizer create-event, filters). */
export async function getPublicEventCategoriesHandler(_req: Request, res: Response) {
  try {
    const categories = await listActiveEventCategoriesPublic();
    return res.json({ success: true, data: categories });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Failed to load event categories",
    });
  }
}

/** Homepage / browse: active categories from DB + published public event counts. */
export async function getEventCategoriesBrowseHandler(_req: Request, res: Response) {
  try {
    const categories = await listActiveEventCategoriesWithEventCounts();
    return res.json({ success: true, categories });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Failed to load event categories",
    });
  }
}

export async function getEventsHandler(req: Request, res: Response) {
  try {
    const {
      page,
      limit,
      category,
      search,
      location,
      startDate,
      endDate,
      featured,
      sort,
      verified,
      vip,
      stats,
    } = req.query;

    // If stats=true, return category stats (backward-compatible behavior)
    if (stats === "true") {
      const data = await getCategoryStats();
      return res.json({
        success: true,
        ...data,
      });
    }

    const pageNum = page ? parseInt(page as string, 10) : undefined;
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;

    const result = await listEvents({
      page: pageNum,
      limit: limitNum,
      category: (category as string | undefined) ?? null,
      search: (search as string | undefined) ?? "",
      location: (location as string | undefined) ?? null,
      startDate: (startDate as string | undefined) ?? null,
      endDate: (endDate as string | undefined) ?? null,
      featured: featured === "true",
      sort: (sort as string | undefined) ?? "newest",
      verified: verified === "true",
      vip: vip === "true",
    });

    return res.json({
      success: true,
      events: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching events (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch events",
      details: error.message,
    });
  }
}

export async function getEventByIdHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
    const event = await getEventByIdentifier(id, viewerId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Note: we don't set cache headers here; that can be done at gateway/proxy level
    return res.json(event);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching event (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function patchEventByIdHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const body = (req.body ?? {}) as {
      description?: string;
      tags?: string[];
      images?: string[];
      brochure?: string | null;
      layoutPlan?: string | null;
      startDate?: string;
      endDate?: string;
    };

    const hasSchedule = body.startDate != null || body.endDate != null;
    const auth = req.auth;

    if (hasSchedule) {
      if (!auth?.sub) {
        return res.status(401).json({ success: false, error: "Authentication required to update schedule" });
      }
      const scheduleResult = await updateEventSchedule(id, body, auth.sub, auth.role);
      if (scheduleResult.error === "NOT_FOUND") {
        return res.status(404).json({ success: false, error: "Event not found" });
      }
      if (scheduleResult.error === "FORBIDDEN") {
        return res.status(403).json({ success: false, error: "Not allowed to update this event schedule" });
      }
      if (scheduleResult.error === "INVALID_DATES" || scheduleResult.error === "END_BEFORE_START") {
        return res.status(400).json({ success: false, error: scheduleResult.error });
      }
      const ev = scheduleResult.event!;
      const schedulePayload = {
        startDate: ev.startDate.toISOString(),
        endDate: ev.endDate.toISOString(),
        previousStartDate: ev.previousStartDate?.toISOString() ?? null,
        previousEndDate: ev.previousEndDate?.toISOString() ?? null,
        isPostponed: ev.isPostponed,
        timezone: ev.timezone,
      };

      const { startDate: _s, endDate: _e, ...restBody } = body;
      const hasOtherFields = Object.keys(restBody).some(
        (k) => restBody[k as keyof typeof restBody] !== undefined,
      );
      if (!hasOtherFields) {
        return res.json({ id: ev.id, ...schedulePayload });
      }
      const updated = await updateEventFields(id, restBody);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Event not found" });
      }
      return res.json({ ...updated, ...schedulePayload });
    }

    const updated = await updateEventFields(id, body);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    return res.json(updated);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error patching event (backend):", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function getFeaturedEventsHandler(_req: Request, res: Response) {
  try {
    const events = await getFeaturedEvents();
    return res.json(events);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Failed to fetch featured events (backend):", error);
    return res.status(500).json({ error: "Failed to fetch featured events" });
  }
}

export async function getRecentEventsHandler(_req: Request, res: Response) {
  try {
    const events = await listRecentEvents(10);
    return res.json(events);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Failed to fetch recent events (backend):", error);
    return res.status(500).json({ error: "Failed to fetch recent events" });
  }
}

export async function getVipEventsHandler(_req: Request, res: Response) {
  try {
    const events = await listVipEvents(12);
    // Array kept for older clients; object shape for structured consumers.
    return res.json({ success: true, events });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Failed to fetch VIP events (backend):", error);
    return res.status(500).json({ error: "Failed to fetch VIP events" });
  }
}

// ----- Event sub-resources -----

export async function getEventAttendeesHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const attendeeLeads = await listEventAttendees(id);
    return res.json({
      success: true,
      attendeeLeads,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching event attendees (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event attendees",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getEventLeadsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const leads = await listEventLeads(id);
    return res.json({
      success: true,
      data: {
        leads,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching event leads (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event leads",
      details: error.message,
    });
  }
}

export async function createEventLeadHandler(req: Request, res: Response) {
  try {
    const { id: eventId } = req.params;
    const { type } = req.body as { type?: string; userId?: string };
    const userId = req.auth?.sub;

    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!type) {
      return res.status(400).json({ error: "type is required" });
    }

    const result = await createEventLead({ eventId, userId, type });

    if ("error" in result) {
      if (result.error === "EVENT_NOT_FOUND") {
        return res.status(404).json({ error: "Event not found" });
      }
      if (result.error === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(400).json({ error: "Bad request" });
    }

    if (result.alreadyExists) {
      return res.status(200).json({
        success: true,
        message: result.message,
        lead: result.lead,
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message,
      lead: result.lead,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error creating event lead (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getEventExhibitorsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const exhibitors = await listEventExhibitors(id);
    return res.json({
      success: true,
      data: {
        exhibitors,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching event exhibitors (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event exhibitors",
      details: error.message,
    });
  }
}

export async function getEventSpeakersHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const speakers = await listEventSpeakers(id);
    return res.json({
      success: true,
      data: {
        speakers,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching event speakers (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event speakers",
      details: error.message,
    });
  }
}

// Global speakers/session listing for /api/events/speakers
export async function listSpeakerSessionsHandler(req: Request, res: Response) {
  try {
    const { eventId, speakerId } = req.query;

    if (!eventId && !speakerId) {
      return res.status(400).json({
        success: false,
        error: "eventId or speakerId is required",
      });
    }

    const sessions = await listSpeakerSessions({
      eventId: (eventId as string | undefined) ?? null,
      speakerId: (speakerId as string | undefined) ?? null,
    });

    // Serialize for JSON (e.g. Date -> ISO string)
    const serialized = sessions.map((s: any) => ({
      ...s,
      startTime: s.startTime instanceof Date ? s.startTime.toISOString() : s.startTime,
      endTime: s.endTime instanceof Date ? s.endTime.toISOString() : s.endTime,
      event: s.event
        ? {
            ...s.event,
            startDate: s.event.startDate instanceof Date ? s.event.startDate.toISOString() : s.event.startDate,
            endDate: s.event.endDate instanceof Date ? s.event.endDate.toISOString() : s.event.endDate,
          }
        : null,
    }));

    return res.json({
      success: true,
      sessions: serialized,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error listing speaker sessions (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to list speaker sessions",
      details: error?.message,
      sessions: [],
    });
  }
}

export async function getEventBrochureHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const event = await getEventBrochureAndDocuments(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }
    return res.json({
      success: true,
      data: {
        eventId: event.id,
        brochure: event.brochure,
        documents: event.documents,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching event brochure (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event brochure",
      details: error.message,
    });
  }
}

export async function updateEventLayoutHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { layoutPlan } = req.body as { layoutPlan?: string | null };

    if (layoutPlan !== null && typeof layoutPlan !== "string") {
      return res.status(400).json({
        success: false,
        error: "layoutPlan must be a string or null",
      });
    }

    const updated = await updateEventLayoutPlan(id, layoutPlan ?? null);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error updating event layout (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update event layout",
      details: error.message,
    });
  }
}

export async function deleteEventLayoutHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updated = await updateEventLayoutPlan(id, null);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error deleting event layout (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete event layout",
      details: error.message,
    });
  }
}

export async function getEventSpaceCostsHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const spaces = await listEventSpaceCosts(id);
    return res.json({
      success: true,
      data: {
        spaces,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching event space costs (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event space costs",
      details: error.message,
    });
  }
}

export async function getExhibitionSpacesHandler(req: Request, res: Response) {
  try {
    const { id: eventId } = req.params;
    const exhibitionSpaces = await listExhibitionSpaces(eventId);
    return res.json({ exhibitionSpaces });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching exhibition spaces (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch exhibition spaces",
      details: error.message,
    });
  }
}

export async function createExhibitionSpaceHandler(req: Request, res: Response) {
  try {
    const { id: eventId } = req.params;
    const result = await createExhibitionSpace(eventId, req.body ?? {});
    if ("error" in result) {
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Event not found" });
      }
      if (result.error === "NAME_REQUIRED") {
        return res.status(400).json({ error: "name is required" });
      }
      return res.status(400).json({ error: "Bad request" });
    }
    return res.status(201).json(result);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error creating exhibition space (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create exhibition space",
      details: error.message,
    });
  }
}

export async function updateExhibitionSpaceHandler(req: Request, res: Response) {
  try {
    const { id: eventId, spaceId } = req.params;
    const updated = await updateExhibitionSpace(eventId, spaceId, req.body ?? {});
    if (!updated) {
      return res.status(404).json({ error: "Exhibition space not found" });
    }
    return res.json(updated);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error updating exhibition space (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update exhibition space",
      details: error.message,
    });
  }
}

export async function addExhibitorToEventHandler(req: Request, res: Response) {
  try {
    const { id: eventId } = req.params;
    const result = await addExhibitorToEvent(eventId, req.body ?? {});
    if ("error" in result) {
      if (result.error === "EVENT_NOT_FOUND") {
        return res.status(404).json({ error: "Event not found" });
      }
      if (result.error === "EXHIBITOR_NOT_FOUND") {
        return res.status(404).json({ error: "Exhibitor not found" });
      }
      if (result.error === "SPACE_NOT_FOUND") {
        return res.status(404).json({ error: "Exhibition space not found" });
      }
      if (result.error === "ALREADY_REGISTERED") {
        return res.status(409).json({ error: "Exhibitor is already registered for this event" });
      }
      return res.status(400).json({ error: "Bad request" });
    }
    return res.status(201).json(result.booth);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error adding exhibitor to event (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to add exhibitor to event",
      details: error.message,
    });
  }
}

export async function removeExhibitorFromEventHandler(req: Request, res: Response) {
  try {
    const { id: eventId, exhibitorId } = req.params;
    if (!exhibitorId) {
      return res.status(400).json({ error: "Exhibitor ID required" });
    }
    const removed = await removeExhibitorFromEvent(eventId, exhibitorId);
    if (!removed) {
      return res.status(404).json({ error: "Exhibitor not found for this event" });
    }
    return res.status(200).json({ success: true });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error removing exhibitor from event (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to remove exhibitor from event",
      details: error.message,
    });
  }
}

export async function getEventsStatsHandler(req: Request, res: Response) {
  try {
    const include = (req.query.include as string | undefined) ?? "";
    const includes = include ? include.split(",") : [];

    const includeCategories = includes.length === 0 || includes.includes("categories");
    const includeCities = includes.includes("cities");
    const includeCountries = includes.includes("countries");

    const result = await getEventStats({
      includeCategories,
      includeCities,
      includeCountries,
    });

    return res.json(result);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Error fetching stats (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch stats",
      details: error.message,
    });
  }
}

export async function searchHandler(req: Request, res: Response) {
  try {
    const q = (req.query.q as string | undefined) ?? "";
    const limit = req.query.limit ? Number(req.query.limit) : 5;

    const result = await searchEntities(q, limit);

    return res.json(result);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Search API error (backend):", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ----- Write handlers (requireUser for save/promotions) -----

export async function saveEventHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    if (auth.domain !== "USER") {
      return res.status(403).json({ error: "Only user accounts can save events" });
    }
    const userId = auth.sub;
    const eventId = req.params.id!;
    const result = await saveEvent(userId, eventId);
    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({ error: "Event not found" });
    }
    if ("alreadySaved" in result && result.alreadySaved) {
      return res.json({ message: "Event already saved", saved: true });
    }
    return res.json({
      message: "Event saved successfully",
      savedEvent: result.savedEvent,
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Save event error (backend):", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function unsaveEventHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    if (auth.domain !== "USER") {
      return res.status(403).json({ error: "Only user accounts can unsave events" });
    }
    const userId = auth.sub;
    const eventId = req.params.id!;
    await unsaveEvent(userId, eventId);
    return res.json({ message: "Event removed from saved" });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Unsave event error (backend):", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function isEventSavedHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    if (auth.domain !== "USER") {
      return res.json({ isSaved: false });
    }
    const userId = auth.sub;
    const eventId = req.params.id!;
    const saved = await isEventSaved(userId, eventId);
    return res.json({ isSaved: saved });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Is event saved error (backend):", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getEventPromotionsHandler(req: Request, res: Response) {
  try {
    const eventId = req.params.id!;
    const data = await getEventPromotions(eventId);
    if (!data) {
      return res.status(404).json({ error: "Event not found" });
    }
    return res.json(data);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Get event promotions error (backend):", err);
    return res.status(500).json({ error: "Failed to fetch promotion data" });
  }
}

export async function createPromotionHandler(req: Request, res: Response) {
  try {
    const eventId = req.params.id!;
    const body = req.body as {
      packageType?: string;
      targetCategories?: string[];
      amount?: number;
      duration?: number;
    };
    const packageType = body.packageType ?? "";
    const targetCategories = Array.isArray(body.targetCategories) ? body.targetCategories : [];
    const amount = Number(body.amount) || 0;
    const duration = Number(body.duration) || 0;
    const result = await createPromotion(eventId, {
      packageType,
      targetCategories,
      amount,
      duration,
    });
    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({ error: "Event not found" });
    }
    return res.status(201).json(result.promotion);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Create promotion error (backend):", err);
    return res.status(500).json({ error: "Failed to create promotion" });
  }
}

export async function createEventAdminHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    if (auth.domain !== "ADMIN" || (auth.role !== "SUPER_ADMIN" && auth.role !== "SUB_ADMIN")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const result = await createEventAdmin({
      body: req.body,
      adminId: auth.sub,
      adminType: auth.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "SUB_ADMIN",
      ipAddress: req.headers["x-forwarded-for"] as string ?? req.socket?.remoteAddress,
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
      if (result.error === "INVALID_YOUTUBE_URL") {
        return res.status(400).json({
          error: (result as { message?: string }).message ?? "Invalid YouTube URL",
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
    console.error("Create event (admin) error (backend):", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: err?.message,
    });
  }
}

export async function createSpeakerSessionHandler(req: Request, res: Response) {
  try {
    const auth = req.auth;
    if (!auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await createSpeakerSession(req.body ?? {});

    return res.status(201).json({
      success: true,
      session,
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Create speaker session error (backend):", err);
    return res.status(400).json({
      success: false,
      error: err?.message || "Failed to create speaker session",
    });
  }
}

/** GET /api/events/:id/followers — users who saved this event (event followers). */
export async function getEventFollowersHandler(req: Request, res: Response) {
  try {
    const { id: eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ error: "Event ID required" });
    }
    const saved = await prisma.savedEvent.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
            company: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { savedAt: "desc" },
    });
    return res.json({
      followers: saved.map((s) => ({
        ...s,
        savedAt: s.savedAt.toISOString(),
      })),
      total: saved.length,
    });
  } catch (err: any) {
    console.error("Error fetching event followers:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** GET /api/events/:id/reviews — event reviews with user info. */
export async function getEventReviewsHandler(req: Request, res: Response) {
  try {
    const { id: eventId } = req.params;
    const includeReplies = req.query.includeReplies === "true";
    if (!eventId) {
      return res.status(400).json({ error: "Event ID required" });
    }
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, averageRating: true, totalReviews: true },
    });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    const reviews = await prisma.review.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });
    const reviewsWithUsers = await Promise.all(
      reviews.map(async (r) => {
        const user = r.userId
          ? await prisma.user.findUnique({
              where: { id: r.userId },
              select: { id: true, firstName: true, lastName: true, avatar: true },
            })
          : null;
        let replies: any[] = [];
        if (includeReplies) {
          const replyRows = await prisma.reviewReply.findMany({
            where: { reviewId: r.id },
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, avatar: true },
              },
            },
            orderBy: { createdAt: "asc" },
          });
          replies = replyRows.map((rep) => ({
            id: rep.id,
            content: rep.content,
            isOrganizerReply: rep.isOrganizerReply,
            createdAt: rep.createdAt.toISOString(),
            user: rep.user || { id: rep.userId, firstName: "Unknown", lastName: "User", avatar: null },
          }));
        }
        return {
          id: r.id,
          rating: r.rating,
          title: (r as any).title ?? "",
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
          isApproved: true,
          isPublic: true,
          user: user || { id: r.userId, firstName: "Unknown", lastName: "User", avatar: null },
          replies: includeReplies ? replies : undefined,
        };
      })
    );
    return res.json({
      event: {
        ...event,
        averageRating: event.averageRating ?? 0,
        totalReviews: event.totalReviews ?? 0,
      },
      reviews: reviewsWithUsers,
    });
  } catch (err: any) {
    console.error("Error fetching event reviews:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** POST /api/events/:id/reviews — create event review (authenticated). */
export async function createEventReviewHandler(req: Request, res: Response) {
  try {
    const { id: eventId } = req.params;
    const userId = req.auth?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!eventId) {
      return res.status(400).json({ error: "Event ID required" });
    }
    const { rating, title, comment } = req.body || {};
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    const existing = await prisma.review.findFirst({
      where: { eventId, userId },
    });
    if (existing) {
      return res.status(400).json({ error: "You have already reviewed this event" });
    }
    const review = await prisma.review.create({
      data: {
        eventId,
        userId,
        rating: Number(rating),
        comment: comment ?? title ?? "",
      },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, avatar: true },
    });
    const reviews = await prisma.review.findMany({
      where: { eventId },
      select: { rating: true },
    });
    const totalRating = reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0);
    const averageRating = reviews.length ? totalRating / reviews.length : 0;
    await prisma.event.update({
      where: { id: eventId },
      data: { averageRating, totalReviews: reviews.length },
    });
    return res.status(201).json({
      ...review,
      createdAt: review.createdAt.toISOString(),
      user: user || { id: userId, firstName: "Unknown", lastName: "User", avatar: null },
    });
  } catch (err: any) {
    console.error("Error creating event review:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

