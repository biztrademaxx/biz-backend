"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEventAppointments = listEventAppointments;
exports.createEventAppointment = createEventAppointment;
exports.updateEventAppointment = updateEventAppointment;
exports.listVenueAppointments = listVenueAppointments;
exports.createVenueAppointment = createVenueAppointment;
exports.updateVenueAppointment = updateVenueAppointment;
const prisma_1 = __importDefault(require("../../config/prisma"));
// ─── Event–exhibitor appointments (Schedule Meeting) ───────────────────────
async function listEventAppointments(params) {
    const where = {};
    if (params.exhibitorId)
        where.exhibitorId = params.exhibitorId;
    if (params.requesterId)
        where.requesterId = params.requesterId;
    if (params.eventId)
        where.eventId = params.eventId;
    const appointments = await prisma_1.default.appointment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
            requester: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    company: true,
                    jobTitle: true,
                    avatar: true,
                },
            },
            exhibitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    company: true,
                    avatar: true,
                },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                    endDate: true,
                },
            },
        },
    });
    return {
        appointments,
        total: appointments.length,
    };
}
async function createEventAppointment(body) {
    const { eventId, exhibitorId, requesterId, title, description, type = "CONSULTATION", requestedDate, requestedTime, duration = 60, meetingType = "IN_PERSON", location, purpose, agenda = [], notes = "", priority = "MEDIUM", } = body;
    if (!eventId || !exhibitorId || !requesterId || !title || !requestedDate || !requestedTime) {
        throw new Error("Missing required fields: eventId, exhibitorId, requesterId, title, requestedDate, requestedTime");
    }
    const parsedDate = new Date(requestedDate);
    if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date format for requestedDate");
    }
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true, title: true },
    });
    if (!event) {
        throw new Error("Event not found");
    }
    const [requester, exhibitor] = await Promise.all([
        prisma_1.default.user.findUnique({
            where: { id: requesterId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                company: true,
                jobTitle: true,
            },
        }),
        prisma_1.default.user.findUnique({
            where: { id: exhibitorId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                company: true,
            },
        }),
    ]);
    if (!requester) {
        throw new Error("Requester not found");
    }
    if (!exhibitor) {
        throw new Error("Exhibitor not found");
    }
    const existing = await prisma_1.default.appointment.findFirst({
        where: {
            eventId,
            exhibitorId,
            requesterId,
            requestedDate: parsedDate,
            requestedTime: requestedTime || "09:00",
            status: { not: "CANCELLED" },
        },
    });
    if (existing) {
        throw new Error("An appointment already exists for this time slot");
    }
    const appointment = await prisma_1.default.appointment.create({
        data: {
            eventId,
            exhibitorId,
            requesterId,
            title,
            description: description || "",
            type: type || "CONSULTATION",
            requestedDate: parsedDate,
            requestedTime: requestedTime || "09:00",
            duration: Number(duration) || 60,
            meetingType: meetingType || "IN_PERSON",
            location: location || "",
            purpose: purpose || "",
            agenda: Array.isArray(agenda) ? agenda : [],
            notes: notes || "",
            priority: priority || "MEDIUM",
            requesterCompany: requester.company || "",
            requesterTitle: requester.jobTitle || "",
            requesterPhone: requester.phone || "",
            requesterEmail: requester.email || "",
        },
        include: {
            requester: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    company: true,
                    avatar: true,
                },
            },
            exhibitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    company: true,
                    avatar: true,
                },
            },
            event: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
    });
    return {
        success: true,
        appointment,
        message: "Appointment request sent successfully!",
    };
}
async function updateEventAppointment(body) {
    const { appointmentId, status, notes, confirmedDate, confirmedTime, outcome, cancellationReason, } = body;
    if (!appointmentId) {
        throw new Error("Appointment ID is required");
    }
    const updateData = {};
    if (status != null)
        updateData.status = status;
    if (notes !== undefined)
        updateData.notes = notes;
    if (outcome != null)
        updateData.outcome = outcome;
    if (cancellationReason != null)
        updateData.cancellationReason = cancellationReason;
    if (confirmedDate != null)
        updateData.confirmedDate = new Date(confirmedDate);
    if (confirmedTime != null)
        updateData.confirmedTime = confirmedTime;
    if (status === "CANCELLED") {
        updateData.cancelledAt = new Date();
        if (body.cancelledBy)
            updateData.cancelledBy = body.cancelledBy;
    }
    const appointment = await prisma_1.default.appointment.update({
        where: { id: appointmentId },
        data: updateData,
        include: {
            requester: { select: { id: true, firstName: true, lastName: true, email: true, company: true, avatar: true } },
            exhibitor: { select: { id: true, firstName: true, lastName: true, email: true, company: true, avatar: true } },
            event: { select: { id: true, title: true } },
        },
    });
    return {
        success: true,
        appointment,
        message: "Appointment updated successfully!",
    };
}
// ─── Venue appointments ────────────────────────────────────────────────────
async function listVenueAppointments(params) {
    const where = {};
    if (params.venueId) {
        where.venueId = params.venueId;
    }
    if (params.requesterId) {
        where.visitorId = params.requesterId;
    }
    const [appointments, total] = await Promise.all([
        prisma_1.default.venueAppointment.findMany({
            where,
            orderBy: { requestedDate: "desc" },
            take: 200,
            include: {
                venue: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                    },
                },
                visitor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                        company: true,
                        jobTitle: true,
                    },
                },
            },
        }),
        prisma_1.default.venueAppointment.count({ where }),
    ]);
    return {
        appointments,
        total,
    };
}
async function createVenueAppointment(body) {
    const { venueId, visitorId, title, description, type, requestedDate, requestedTime, duration, meetingType, purpose, location, meetingSpacesInterested, } = body;
    if (!venueId) {
        throw new Error("venueId is required");
    }
    const requestedDateObj = requestedDate
        ? new Date(requestedDate)
        : new Date();
    const created = await prisma_1.default.venueAppointment.create({
        data: {
            venueId,
            visitorId: visitorId ?? null,
            requestedDate: requestedDateObj,
            requestedTime: requestedTime || "09:00",
            duration: duration ? Number(duration) : 30,
            purpose: purpose ||
                description ||
                `Meeting request (${meetingType || "IN_PERSON"})`,
            notes: description || null,
            location: location || null,
            type: type || "VENUE_TOUR",
            status: "PENDING",
            priority: "MEDIUM",
        },
    });
    return {
        success: true,
        appointment: created,
        message: title
            ? `Appointment "${title}" created`
            : "Appointment created",
    };
}
async function updateVenueAppointment(body) {
    const { id, status } = body;
    if (!id) {
        throw new Error("Appointment id is required");
    }
    const updated = await prisma_1.default.venueAppointment.update({
        where: { id },
        data: {
            status: status || undefined,
        },
    });
    return {
        success: true,
        appointment: updated,
        message: "Appointment updated",
    };
}
