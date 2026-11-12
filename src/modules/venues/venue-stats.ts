import prisma from "../../config/prisma";

export async function getVenueEventStats(venueId: string) {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  // Include the boundary day for venues ahead of UTC; the display groups in venue time.
  since.setUTCDate(since.getUTCDate() - 1);
  const [totalEvents, activeBookings, monthlyEvents] = await Promise.all([
    prisma.event.count({ where: { venueId } }),
    prisma.event.count({ where: { venueId, endDate: { gte: now } } }),
    prisma.event.groupBy({
      by: ["startDate"],
      where: { venueId, startDate: { gte: since } },
      _count: { _all: true },
      orderBy: { startDate: "asc" },
    }),
  ]);
  return { totalEvents, activeBookings, monthlyEvents: monthlyEvents.map((row) => ({
    startDate: row.startDate.toISOString(), count: row._count._all,
  })) };
}
