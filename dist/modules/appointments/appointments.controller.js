"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointmentsHandler = getAppointmentsHandler;
exports.createAppointmentHandler = createAppointmentHandler;
exports.updateAppointmentHandler = updateAppointmentHandler;
exports.getVenueAppointmentsHandler = getVenueAppointmentsHandler;
exports.createVenueAppointmentHandler = createVenueAppointmentHandler;
exports.updateVenueAppointmentHandler = updateVenueAppointmentHandler;
const appointments_service_1 = require("./appointments.service");
// ─── Event–exhibitor appointments (Schedule Meeting) ───────────────────────
async function getAppointmentsHandler(req, res) {
    try {
        const { exhibitorId, requesterId, eventId } = req.query;
        if (!exhibitorId && !requesterId && !eventId) {
            return res.status(400).json({ error: "Missing required parameters" });
        }
        const result = await (0, appointments_service_1.listEventAppointments)({
            exhibitorId,
            requesterId,
            eventId,
        });
        const formatted = result.appointments.map((apt) => {
            const reqDate = apt.requestedDate
                ? new Date(apt.requestedDate).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0];
            const reqTime = apt.requestedTime || "09:00";
            const exhibitor = apt.exhibitor;
            return {
                id: apt.id,
                exhibitorId: apt.exhibitorId || "",
                exhibitorName: exhibitor
                    ? `${exhibitor.firstName || ""} ${exhibitor.lastName || ""}`.trim() || "Exhibitor"
                    : "Exhibitor",
                exhibitorCompany: exhibitor?.company || apt.requesterCompany || "N/A",
                exhibitorEmail: exhibitor?.email || "",
                exhibitorPhone: exhibitor?.phone || "",
                exhibitorAvatar: exhibitor?.avatar || null,
                eventId: apt.event?.id || apt.eventId,
                eventName: apt.event?.title || "Unknown Event",
                eventTitle: apt.event?.title || "Unknown Event",
                eventStartDate: apt.event?.startDate ? new Date(apt.event.startDate).toISOString() : null,
                eventEndDate: apt.event?.endDate ? new Date(apt.event.endDate).toISOString() : null,
                visitorName: apt.requester
                    ? `${apt.requester.firstName || ""} ${apt.requester.lastName || ""}`.trim()
                    : "Unknown Visitor",
                visitorEmail: apt.requester?.email || apt.requesterEmail || "",
                visitorPhone: apt.requester?.phone || apt.requesterPhone || "",
                company: apt.requester?.company || apt.requesterCompany || "Unknown",
                designation: apt.requester?.jobTitle || apt.requesterTitle || "Unknown",
                requestedDate: reqDate,
                requestedTime: reqTime,
                scheduledAt: `${reqDate}T${reqTime}:00.000Z` || apt.createdAt?.toISOString?.(),
                duration: apt.duration ?? 60,
                purpose: apt.purpose || apt.description || "General meeting",
                status: apt.status || "PENDING",
                priority: apt.priority || "MEDIUM",
                notes: apt.notes || "",
                meetingLink: apt.meetingLink || "",
                location: apt.location || "",
                createdAt: apt.createdAt?.toISOString?.(),
            };
        });
        return res.json({
            success: true,
            appointments: formatted,
            total: formatted.length,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error listing appointments:", err);
        return res.status(500).json({
            error: "Internal server error",
            appointments: [],
            total: 0,
        });
    }
}
async function createAppointmentHandler(req, res) {
    try {
        const result = await (0, appointments_service_1.createEventAppointment)(req.body ?? {});
        return res.status(201).json({
            success: true,
            appointment: result.appointment,
            message: result.message ?? "Appointment request sent successfully!",
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error creating appointment:", err);
        const message = err instanceof Error ? err.message : "Failed to create appointment";
        if (message.includes("not found") ||
            message.includes("Event not found") ||
            message.includes("Requester not found") ||
            message.includes("Exhibitor not found")) {
            return res.status(404).json({ error: message });
        }
        if (message.includes("already exists")) {
            return res.status(409).json({ error: message });
        }
        if (message.includes("Missing required") || message.includes("Invalid date")) {
            return res.status(400).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
async function updateAppointmentHandler(req, res) {
    try {
        const result = await (0, appointments_service_1.updateEventAppointment)(req.body ?? {});
        return res.json({
            success: true,
            appointment: result.appointment,
            message: result.message ?? "Appointment updated successfully!",
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error updating appointment:", err);
        const message = err instanceof Error ? err.message : "Failed to update appointment";
        if (message.includes("not found") || message.includes("Record to update not found")) {
            return res.status(404).json({ error: "Appointment not found" });
        }
        return res.status(500).json({ error: message });
    }
}
// ─── Venue appointments ────────────────────────────────────────────────────
async function getVenueAppointmentsHandler(req, res) {
    try {
        const { venueId, requesterId } = req.query;
        const result = await (0, appointments_service_1.listVenueAppointments)({ venueId, requesterId });
        const apiAppointments = result.appointments.map((apt) => ({
            id: apt.id,
            venueId: apt.venueId,
            requesterId: apt.visitorId ?? "",
            title: apt.purpose ?? "Venue booking",
            requester: apt.visitor
                ? {
                    id: apt.visitor.id,
                    firstName: apt.visitor.firstName,
                    lastName: apt.visitor.lastName,
                    email: apt.visitor.email,
                    avatar: apt.visitor.avatar,
                }
                : {
                    id: "",
                    firstName: "Guest",
                    lastName: "",
                    email: "",
                    avatar: null,
                },
            venue: apt.venue
                ? {
                    id: apt.venue.id,
                    firstName: apt.venue.firstName ?? "",
                    lastName: apt.venue.lastName ?? "",
                    email: apt.venue.email ?? "",
                    avatar: apt.venue.avatar ?? null,
                }
                : {
                    id: "",
                    firstName: "Venue",
                    lastName: "",
                    email: "",
                    avatar: null,
                },
            requesterPhone: apt.visitor?.phone ?? "",
            requesterCompany: apt.visitor?.company ?? "",
            requesterTitle: apt.visitor?.jobTitle ?? "",
            requestedDate: apt.requestedDate?.toISOString?.() ?? new Date().toISOString(),
            requestedTime: apt.requestedTime ?? "09:00",
            duration: apt.duration ?? 30,
            purpose: apt.purpose ?? "",
            status: apt.status ?? "PENDING",
            priority: apt.priority ?? "MEDIUM",
            notes: apt.notes ?? "",
            meetingLink: apt.meetingLink ?? "",
            location: apt.location ?? "",
            type: apt.type ?? "VENUE_TOUR",
            meetingType: "IN_PERSON",
            agenda: [],
            meetingSpacesInterested: [],
            reminderSent: false,
            followUpRequired: false,
            createdAt: apt.createdAt?.toISOString?.() ?? new Date().toISOString(),
            updatedAt: apt.updatedAt?.toISOString?.() ?? new Date().toISOString(),
        }));
        return res.json({
            success: true,
            data: apiAppointments,
            total: result.total,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error listing venue appointments:", err);
        return res.status(500).json({
            success: false,
            error: "Failed to list venue appointments",
        });
    }
}
async function createVenueAppointmentHandler(req, res) {
    try {
        const result = await (0, appointments_service_1.createVenueAppointment)(req.body ?? {});
        return res.status(201).json({
            success: true,
            message: result.message ?? "Appointment created",
            data: result.appointment,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error creating venue appointment:", err);
        return res.status(500).json({
            success: false,
            error: "Failed to create venue appointment",
        });
    }
}
async function updateVenueAppointmentHandler(req, res) {
    try {
        const result = await (0, appointments_service_1.updateVenueAppointment)(req.body ?? {});
        return res.json({
            success: true,
            message: result.message ?? "Appointment updated",
            data: result.appointment,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error updating venue appointment:", err);
        return res.status(500).json({
            success: false,
            error: "Failed to update venue appointment",
        });
    }
}
