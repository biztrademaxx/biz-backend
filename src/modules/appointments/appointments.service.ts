import prisma from "../../config/prisma";

// ─── Event–exhibitor appointments (Schedule Meeting) ───────────────────────

export async function listEventAppointments(params: {
  exhibitorId?: string;
  requesterId?: string;
  eventId?: string;
}) {
  const where: any = {};
  if (params.exhibitorId) where.exhibitorId = params.exhibitorId;
  if (params.requesterId) where.requesterId = params.requesterId;
  if (params.eventId) where.eventId = params.eventId;

  const appointments = await prisma.appointment.findMany({
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

export async function createEventAppointment(body: Record<string, any>) {
  const {
    eventId,
    exhibitorId,
    requesterId,
    title,
    description,
    type = "CONSULTATION",
    requestedDate,
    requestedTime,
    duration = 60,
    meetingType = "IN_PERSON",
    location,
    purpose,
    agenda = [],
    notes = "",
    priority = "MEDIUM",
  } = body;

  if (!eventId || !exhibitorId || !requesterId || !title || !requestedDate || !requestedTime) {
    throw new Error(
      "Missing required fields: eventId, exhibitorId, requesterId, title, requestedDate, requestedTime"
    );
  }

  const parsedDate = new Date(requestedDate);
  if (isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date format for requestedDate");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });
  if (!event) {
    throw new Error("Event not found");
  }

  const [requester, exhibitor] = await Promise.all([
    prisma.user.findUnique({
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
    prisma.user.findUnique({
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

  const existing = await prisma.appointment.findFirst({
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

  const appointment = await prisma.appointment.create({
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

export async function updateEventAppointment(body: Record<string, any>) {
  const {
    appointmentId,
    status,
    notes,
    confirmedDate,
    confirmedTime,
    outcome,
    cancellationReason,
  } = body;

  if (!appointmentId) {
    throw new Error("Appointment ID is required");
  }

  const updateData: Record<string, any> = {};
  if (status != null) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (outcome != null) updateData.outcome = outcome;
  if (cancellationReason != null) updateData.cancellationReason = cancellationReason;
  if (confirmedDate != null) updateData.confirmedDate = new Date(confirmedDate);
  if (confirmedTime != null) updateData.confirmedTime = confirmedTime;
  if (status === "CANCELLED") {
    updateData.cancelledAt = new Date();
    if (body.cancelledBy) updateData.cancelledBy = body.cancelledBy;
  }

  const appointment = await prisma.appointment.update({
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

export async function listVenueAppointments(params: { venueId?: string; requesterId?: string }) {
  const where: any = {};

  if (params.venueId) {
    where.venueId = params.venueId;
  }
  if (params.requesterId) {
    where.visitorId = params.requesterId;
  }

  const [appointments, total] = await Promise.all([
    prisma.venueAppointment.findMany({
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
            venueName: true,
            venueCity: true,
            venueState: true,
            venueCountry: true,
            venueAddress: true,
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
    prisma.venueAppointment.count({ where }),
  ]);

  return {
    appointments,
    total,
  };
}

export async function createVenueAppointment(body: Record<string, any>) {
  const {
    venueId,
    visitorId,
    title,
    description,
    type,
    requestedDate,
    requestedTime,
    duration,
    meetingType,
    purpose,
    location,
    meetingSpacesInterested,
  } = body;

  if (!venueId) {
    throw new Error("venueId is required");
  }

  const requestedDateObj = requestedDate
    ? new Date(requestedDate)
    : new Date();

  const created = await prisma.venueAppointment.create({
    data: {
      venueId,
      visitorId: visitorId ?? null,
      requestedDate: requestedDateObj,
      requestedTime: requestedTime || "09:00",
      duration: duration ? Number(duration) : 30,
      purpose:
        purpose ||
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

export async function updateVenueAppointment(body: Record<string, any>) {
  const { id, status } = body;

  if (!id) {
    throw new Error("Appointment id is required");
  }

  const updated = await prisma.venueAppointment.update({
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

