import { Request, Response } from "express";
import { sendError } from "../../../lib/admin-response";
import * as eventsSvc from "./venue-events.service";
import * as bookingsSvc from "./venue-bookings.service";
import * as feedbackSvc from "./venue-feedback.service";

export async function listVenueEvents(req: Request, res: Response) {
  try {
    const result = await eventsSvc.listVenueEventsForAdmin(req.query as Record<string, unknown>);
    return res.json({ success: true, ...result });
  } catch (e: any) {
    return sendError(res, 500, "Failed to list venue events", e?.message);
  }
}

export async function listVenueBookings(req: Request, res: Response) {
  try {
    const result = await bookingsSvc.listVenueBookingsForAdmin();
    return res.json(result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list venue bookings", e?.message);
  }
}

export async function updateVenueBooking(req: Request, res: Response) {
  try {
    const result = await bookingsSvc.updateVenueBookingStatus(req.params.id, req.body ?? {});
    if (!result) return sendError(res, 404, "Booking not found");
    return res.json({ success: true, ...result });
  } catch (e: any) {
    return sendError(res, 500, "Failed to update booking", e?.message);
  }
}

export async function listVenueFeedback(req: Request, res: Response) {
  try {
    const result = await feedbackSvc.listVenueFeedbackForAdmin();
    return res.json(result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to list venue feedback", e?.message);
  }
}

export async function updateVenueFeedback(req: Request, res: Response) {
  try {
    const result = await feedbackSvc.updateVenueFeedbackById(req.params.id, req.body ?? {});
    if (!result) return sendError(res, 404, "Feedback not found");
    return res.json({ success: true, ...result });
  } catch (e: any) {
    return sendError(res, 500, "Failed to update feedback", e?.message);
  }
}
