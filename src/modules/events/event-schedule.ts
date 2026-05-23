import prisma from "../../config/prisma";

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameInstant(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

export type EventSchedulePatch = {
  startDate?: string;
  endDate?: string;
};

/** Organizer (or admin) reschedules an event; preserves original dates on first change. */
export async function updateEventSchedule(
  eventId: string,
  body: EventSchedulePatch,
  actorUserId: string,
  actorRole?: string | null,
) {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      startDate: true,
      endDate: true,
      previousStartDate: true,
      previousEndDate: true,
      isPostponed: true,
      timezone: true,
    },
  });

  if (!existing) return { error: "NOT_FOUND" as const };

  const isAdmin = actorRole === "SUPER_ADMIN" || actorRole === "SUB_ADMIN" || actorRole === "ADMIN";
  if (existing.organizerId !== actorUserId && !isAdmin) {
    return { error: "FORBIDDEN" as const };
  }

  const newStart = body.startDate != null ? toDate(body.startDate) : existing.startDate;
  const newEnd = body.endDate != null ? toDate(body.endDate) : existing.endDate;

  if (!newStart || !newEnd) {
    return { error: "INVALID_DATES" as const };
  }
  if (newEnd < newStart) {
    return { error: "END_BEFORE_START" as const };
  }

  const datesChanged =
    !sameInstant(newStart, existing.startDate) || !sameInstant(newEnd, existing.endDate);

  const data: {
    startDate: Date;
    endDate: Date;
    previousStartDate?: Date;
    previousEndDate?: Date;
    isPostponed?: boolean;
  } = {
    startDate: newStart,
    endDate: newEnd,
  };

  if (datesChanged) {
    if (!existing.previousStartDate) {
      data.previousStartDate = existing.startDate;
      data.previousEndDate = existing.endDate;
    }
    data.isPostponed = true;
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      previousStartDate: true,
      previousEndDate: true,
      isPostponed: true,
      timezone: true,
    },
  });

  return { event: updated };
}

export function applyPostponedOnOrganizerDateChange(
  existing: {
    startDate: Date;
    endDate: Date;
    previousStartDate: Date | null;
    previousEndDate: Date | null;
  },
  newStart: Date,
  newEnd: Date,
) {
  const datesChanged =
    !sameInstant(newStart, existing.startDate) || !sameInstant(newEnd, existing.endDate);

  if (!datesChanged) return {};

  const patch: {
    previousStartDate?: Date;
    previousEndDate?: Date;
    isPostponed: boolean;
  } = { isPostponed: true };

  if (!existing.previousStartDate) {
    patch.previousStartDate = existing.startDate;
    patch.previousEndDate = existing.endDate;
  }

  return patch;
}
