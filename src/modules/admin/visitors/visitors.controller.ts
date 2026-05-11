import { Request, Response } from "express";
import { sendOne, sendError } from "../../../lib/admin-response";
import * as service from "./visitors.service";
import * as suggestionsSvc from "./visitor-suggestions.service";
import * as visitorEventsSvc from "./visitor-events.service";
import * as visitorConnectionsSvc from "./visitor-connections.service";
import * as visitorAppointmentsSvc from "./visitor-appointments.service";

export async function list(req: Request, res: Response) {
  try {
    const result = await service.listVisitors(req.query as Record<string, unknown>);
    return res.status(200).json({ success: true, data: result.data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendError(res, 500, "Failed to list visitors", msg);
  }
}

export async function listVisitorEvents(req: Request, res: Response) {
  try {
    const data = await visitorEventsSvc.listVisitorEventsForAdmin();
    return res.status(200).json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendError(res, 500, "Failed to list visitor events", msg);
  }
}

export async function listVisitorConnections(req: Request, res: Response) {
  try {
    const data = await visitorConnectionsSvc.listVisitorConnectionsForAdmin(
      req.query as Record<string, unknown>,
    );
    return res.status(200).json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendError(res, 500, "Failed to list visitor connections", msg);
  }
}

export async function listVisitorAppointments(req: Request, res: Response) {
  try {
    const data = await visitorAppointmentsSvc.listVisitorAppointmentsForAdmin();
    return res.status(200).json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendError(res, 500, "Failed to list visitor appointments", msg);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const item = await service.getVisitorById(req.params.id);
    if (!item) return sendError(res, 404, "Visitor not found");
    return sendOne(res, item);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendError(res, 500, "Failed to get visitor", msg);
  }
}

// Add these two functions
export async function update(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const updated = await service.updateVisitor(id, { isActive });
    if (!updated) return sendError(res, 404, "Visitor not found");
    
    return res.json({ success: true, data: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendError(res, 500, "Failed to update visitor", msg);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deleted = await service.deleteVisitor(id);
    if (!deleted) return sendError(res, 404, "Visitor not found");
    
    return res.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendError(res, 500, "Failed to delete visitor", msg);
  }
}

export async function getVisitorForSuggestion(req: Request, res: Response) {
  try {
    const visitorId = req.params.id;
    console.log("Getting visitor for suggestion:", visitorId);
    const result = await suggestionsSvc.getVisitorForSuggestion(visitorId);
    return res.json({ success: true, data: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in getVisitorForSuggestion:", e);
    return sendError(res, 500, "Failed to get visitor data", msg);
  }
}

export async function getAvailableExhibitors(req: Request, res: Response) {
  try {
    const visitorId = req.params.id;
    const { limit, search, category } = req.query;
    
    console.log("Getting available exhibitors for visitor:", visitorId, { limit, search, category });
    
    const result = await suggestionsSvc.getAvailableExhibitorsForSuggestion(visitorId, {
      limit: limit ? parseInt(limit as string, 10) : 20,
      search: search as string,
      category: category as string,
    });
    
    return res.json({ success: true, data: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in getAvailableExhibitors:", e);
    return sendError(res, 500, "Failed to get available exhibitors", msg);
  }
}

export async function sendSuggestions(req: Request, res: Response) {
  try {
    const visitorId = req.params.id;
    const { exhibitorIds, note } = req.body;
    
    if (!exhibitorIds || !Array.isArray(exhibitorIds) || exhibitorIds.length === 0) {
      return sendError(res, 400, "At least one exhibitor ID is required");
    }
    
    const result = await suggestionsSvc.sendSuggestionsToVisitor(visitorId, exhibitorIds, note);
    
    return res.json({
      success: true,
      message: `Successfully sent ${result.count} suggestions to visitor`,
      data: result,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in sendSuggestions:", e);
    return sendError(res, 500, "Failed to send suggestions", msg);
  }
}

export async function getVisitorSuggestions(req: Request, res: Response) {
  try {
    const visitorId = req.params.id;
    const result = await suggestionsSvc.getVisitorSuggestions(visitorId);
    return res.json({ success: true, data: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in getVisitorSuggestions:", e);
    return sendError(res, 500, "Failed to get visitor suggestions", msg);
  }
}

export async function getAllCategories(req: Request, res: Response) {
  try {
    const result = await suggestionsSvc.getAllCategories();
    return res.json({ success: true, data: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in getAllCategories:", e);
    return sendError(res, 500, "Failed to get categories", msg);
  }
}