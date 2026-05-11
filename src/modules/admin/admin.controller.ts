import { Request, Response } from "express";
import {
  adminListEvents,
  adminGetEventById,
  adminUpdateEvent,
  adminDeleteEvent,
  adminApproveEvent,
  adminRejectEvent,
  adminGetEventStats,
  adminListVenues,
  adminListVisitors,
  adminGetDashboardSummary,
  adminListEventCategories,
  adminVerifyEvent,
  adminGetEventMailCandidates,
  adminSendEventListingEmail,
} from "./admin.service";

export async function adminGetEventsHandler(req: Request, res: Response) {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const status = (req.query.status as string | undefined) ?? undefined;
    const search = (req.query.search as string | undefined) ?? undefined;

    const result = await adminListEvents({ page, limit, status, search });

    return res.json({
      success: true,
      events: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin get events error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch events",
      details: error.message,
    });
  }
}

export async function adminGetEventStatsHandler(_req: Request, res: Response) {
  try {
    const stats = await adminGetEventStats();
    return res.json({
      success: true,
      stats: {
        total: stats.total,
        approved: stats.approved,
        rejected: stats.rejected,
        pending: stats.pending,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin get event stats error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event stats",
      details: error.message,
    });
  }
}

export async function adminGetEventByIdHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const event = await adminGetEventById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin get event by id error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event",
      details: error.message,
    });
  }
}

export async function adminVerifyEventHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const raw = req.body?.isVerified;
    const isVerified =
      raw === true ||
      raw === "true" ||
      String(raw ?? "").toLowerCase() === "true";
    const file = req.file as Express.Multer.File | undefined;
    const verifiedBy = req.auth?.sub || req.auth?.email || "Admin";

    const result = await adminVerifyEvent(id, {
      isVerified,
      badgeBuffer: file?.buffer,
      verifiedBy,
    });

    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.json({
      success: true,
      data: result.event,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin verify event error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update verification",
      details: error.message,
    });
  }
}

export async function adminUpdateEventHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const body = { ...(req.body ?? {}) } as any;

    // Map frontend names to Prisma fields (only these are written; venue/location/organizer are not)
    if (typeof body.featured === "boolean") {
      body.isFeatured = body.featured;
    }
    if (typeof body.vip === "boolean") {
      body.isVIP = body.vip;
    }
    if (body.layout !== undefined) {
      body.layoutPlan = body.layout;
    }
    if (body.maxCapacity !== undefined) {
      body.maxAttendees = body.maxCapacity;
    }

    if (body.isVerified === true && !body.verifiedBy && req.auth?.sub) {
      body.verifiedBy = req.auth.sub;
    }
    const result = await adminUpdateEvent(id, body);

    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    if ("error" in result && result.error === "INVALID_YOUTUBE_URL") {
      return res.status(400).json({
        success: false,
        error: (result as { message?: string }).message ?? "Invalid YouTube URL",
      });
    }

    return res.json({
      success: true,
      data: result.event,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin update event error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update event",
      details: error.message,
    });
  }
}

export async function adminDeleteEventHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await adminDeleteEvent(id);

    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin delete event error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete event",
      details: error.message,
    });
  }
}

export async function adminApproveEventHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { eventId } = req.body as { eventId?: string };

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: "eventId is required",
      });
    }

    const result = await adminApproveEvent(eventId, auth.sub);

    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.json({
      success: true,
      data: result.event,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin approve event error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to approve event",
      details: error.message,
    });
  }
}

export async function adminRejectEventHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    const { eventId, reason } = req.body as { eventId?: string; reason?: string };

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: "eventId is required",
      });
    }

    const result = await adminRejectEvent(eventId, auth.sub, reason);

    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    return res.json({
      success: true,
      data: result.event,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin reject event error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reject event",
      details: error.message,
    });
  }
}

export async function adminGetVenuesHandler(_req: Request, res: Response) {
  try {
    const venues = await adminListVenues();

    return res.json({
      success: true,
      data: {
        venues,
        total: venues.length,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin get venues error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch venues",
      details: error.message,
    });
  }
}

export async function adminGetVisitorsHandler(_req: Request, res: Response) {
  try {
    const visitors = await adminListVisitors();

    return res.json({
      success: true,
      data: {
        visitors,
        total: visitors.length,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin get visitors error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch visitors",
      details: error.message,
    });
  }
}

export async function adminGetDashboardHandler(_req: Request, res: Response) {
  try {
    const summary = await adminGetDashboardSummary();

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin get dashboard error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard data",
      details: error.message,
    });
  }
}

export async function adminGetEventCategoriesHandler(_req: Request, res: Response) {
  try {
    const categories = await adminListEventCategories();
    return res.json(categories);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("Admin get event categories error (backend):", error);
    return res.status(500).json([]);
  }
}

export async function adminGetEventMailCandidatesHandler(_req: Request, res: Response) {
  try {
    const rows = await adminGetEventMailCandidates();
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("Admin get event mail candidates error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event mail candidates",
      details: error.message,
    });
  }
}

export async function adminSendEventListingEmailHandler(req: Request, res: Response) {
  try {
    const organizerEmail = String(req.body?.organizerEmail ?? "").trim();
    const eventTitles = Array.isArray(req.body?.eventTitles)
      ? req.body.eventTitles.map((x: unknown) => String(x)).filter(Boolean)
      : [];

    if (!organizerEmail || eventTitles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "organizerEmail and eventTitles are required",
      });
    }

    await adminSendEventListingEmail({ organizerEmail, eventTitles });
    return res.json({ success: true, message: "Email sent" });
  } catch (error: any) {
    console.error("Admin send event listing email error (backend):", error);
    return res.status(500).json({
      success: false,
      error: "Failed to send email",
      details: error.message,
    });
  }
}

