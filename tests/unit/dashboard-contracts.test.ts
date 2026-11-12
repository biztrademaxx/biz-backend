import prisma from "../../src/config/prisma";
import { listVisitors } from "../../src/modules/admin/visitors/visitors.service";
import { getExhibitorPromotionsMarketingForSelf } from "../../src/modules/exhibitors/exhibitors.service";
import { getVenueEventStats } from "../../src/modules/venues/venue-stats";
import { createEventAdmin } from "../../src/modules/events/events-writes.service";
import { adminUpdateEvent } from "../../src/modules/admin/admin.service";
import { updateEventByOrganizer } from "../../src/modules/events/events.service";

jest.mock("../../src/config/prisma", () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    connection: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    eventRegistration: { groupBy: jest.fn() },
    exhibitorBooth: { findMany: jest.fn() },
    promotion: { findMany: jest.fn() },
    event: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  },
}));
jest.mock("../../src/config/redis", () => ({ invalidateEventCaches: jest.fn(), cached: jest.fn() }));
const db = prisma as any;

beforeEach(() => jest.resetAllMocks());

it("returns matching global Visitor totals independently of the selected page", async () => {
  db.user.findMany.mockResolvedValue([]);
  db.user.count.mockResolvedValue(13);
  db.user.groupBy.mockResolvedValue([
    { isActive: true, isVerified: true, _count: { _all: 9 } },
    { isActive: true, isVerified: false, _count: { _all: 3 } },
    { isActive: false, isVerified: true, _count: { _all: 1 } },
  ]);
  db.connection.findMany.mockResolvedValue([]);
  db.appointment.findMany.mockResolvedValue([]);
  db.eventRegistration.groupBy.mockResolvedValue([]);
  const page1 = await listVisitors({ page: "1", limit: "10", search: "Rohan" });
  const page2 = await listVisitors({ page: "2", limit: "10", search: "Rohan" });
  expect(page1.data.stats).toEqual({ active: 12, inactive: 1, verified: 10 });
  expect(page2.data.stats).toEqual(page1.data.stats);
  expect(db.user.groupBy).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ role: "ATTENDEE", OR: expect.any(Array) }),
  }));
  expect(db.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
});

it("returns real booth IDs, event IDs, and spaces to the promotion selector", async () => {
  const id = "7e626b76-77c5-4ba3-b3a4-5fb8b2649f67";
  const booth = { id: "booth-1", boothNumber: "QA-TECH-01", companyName: "Exhibitormax", status: "BOOKED",
    event: { id: "event-1", title: "Technology Expo", startDate: new Date("2026-11-20"), endDate: new Date("2026-11-21"), bannerImage: null, status: "PUBLISHED", venue: null },
    space: { id: "space-1", name: "Main Hall", spaceType: "SHELL_SCHEME" },
  };
  db.exhibitorBooth.findMany.mockResolvedValue([booth]);
  db.promotion.findMany.mockResolvedValue([]);
  const result = await getExhibitorPromotionsMarketingForSelf(id, id);
  expect(result.booths).toEqual([booth]);
  expect(result.events[0].id).toBe("event-1");
  expect(db.exhibitorBooth.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { exhibitorId: id } }));
  await expect(getExhibitorPromotionsMarketingForSelf(id, "someone-else")).rejects.toThrow("FORBIDDEN");
});

it("calculates Venue totals from events for both load and save responses", async () => {
  db.event.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
  db.event.groupBy.mockResolvedValue([{ startDate: new Date("2026-11-29"), _count: { _all: 1 } }]);
  expect(await getVenueEventStats("venue-1")).toEqual({
    totalEvents: 1, activeBookings: 1, monthlyEvents: [{ startDate: "2026-11-29T00:00:00.000Z", count: 1 }],
  });
});

it("rejects invalid create, organizer edit, and admin edit dates before writing", async () => {
  const invalid = { startDate: "2026-11-06", endDate: "2026-06-13" };
  expect(await createEventAdmin({ body: { title: "Expo", description: "Test", ...invalid }, adminId: "admin", adminType: "SUPER_ADMIN" }))
    .toEqual(expect.objectContaining({ error: "INVALID_DATES" }));
  const existing = { id: "event", organizerId: "organizer", startDate: new Date("2026-11-06"), endDate: new Date("2026-11-07") };
  db.event.findFirst.mockResolvedValue(existing);
  expect(await updateEventByOrganizer("organizer", "event", invalid)).toEqual(expect.objectContaining({ error: "INVALID_DATES" }));
  db.event.findUnique.mockResolvedValue(existing);
  expect(await adminUpdateEvent("event", { endDate: "not-a-date" })).toEqual(expect.objectContaining({ error: "INVALID_DATES" }));
  expect(db.event.update).not.toHaveBeenCalled();
});
