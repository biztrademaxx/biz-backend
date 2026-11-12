import prisma from "../../src/config/prisma";
import { adminGetEventById, adminUpdateEvent } from "../../src/modules/admin/admin.service";
import { invalidateEventCaches, invalidateVenueCaches } from "../../src/config/redis";
import { refreshEventSearchStats } from "../../src/modules/events/event-ranking.service";

jest.mock("../../src/config/prisma", () => ({
  __esModule: true,
  default: {
    event: { findUnique: jest.fn(), update: jest.fn() },
    user: { findFirst: jest.fn() },
    userPlanSubscription: { findFirst: jest.fn() },
  },
}));
jest.mock("../../src/config/redis", () => ({ invalidateEventCaches: jest.fn(), invalidateVenueCaches: jest.fn() }));
jest.mock("../../src/modules/events/event-ranking.service", () => ({ refreshEventSearchStats: jest.fn() }));

const db = prisma as any;
const organizerId = "11111111-1111-4111-8111-111111111111";
const venueId = "22222222-2222-4222-8222-222222222222";
const existing = {
  id: "event", organizerId: "old-organizer", venueId: "old-venue",
  startDate: new Date("2026-11-20"), endDate: new Date("2026-11-21"),
  previousStartDate: null, previousEndDate: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  db.event.findUnique.mockResolvedValue(existing);
  db.event.update.mockImplementation(async ({ data }: any) => ({ ...existing, ...data, slug: "expo" }));
  db.userPlanSubscription.findFirst.mockResolvedValue(null);
  (refreshEventSearchStats as jest.Mock).mockResolvedValue(undefined);
});

it("saves both assignments and derives location from the selected venue", async () => {
  db.user.findFirst.mockResolvedValueOnce({ id: organizerId }).mockResolvedValueOnce({
    id: venueId, venueCity: "Pune", venueState: "Maharashtra", venueCountry: "India",
  });
  db.userPlanSubscription.findFirst.mockResolvedValue({ planSlug: "organizer-gold" });
  const result = await adminUpdateEvent("event", {
    organizerId, venueId, organizer: { email: "overwrite@example.com" }, venue: { venueName: "overwrite" }, city: "wrong",
  });
  expect(result).not.toHaveProperty("error");
  expect(db.user.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: organizerId, role: "ORGANIZER" } }));
  expect(db.user.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: venueId, role: "VENUE_MANAGER" } }));
  const update = db.event.update.mock.calls[0][0];
  expect(update.data).toEqual(expect.objectContaining({
    organizerId, venueId, city: "Pune", state: "Maharashtra", country: "India", organizerPlanTier: "gold",
  }));
  expect(update.data).not.toHaveProperty("organizer");
  expect(update.data).not.toHaveProperty("venue");
  expect(update.include).toHaveProperty("organizer.select.organizationName", true);
  expect(update.include).toHaveProperty("venue.select.venueAddress", true);
  expect(refreshEventSearchStats).toHaveBeenCalledWith("event");
  expect(invalidateEventCaches).toHaveBeenCalled();
  expect(invalidateVenueCaches).toHaveBeenCalled();
});

it("does not rewrite assignments or location during ordinary edits", async () => {
  await adminUpdateEvent("event", { title: "Updated title" });
  const { data } = db.event.update.mock.calls[0][0];
  expect(data).toEqual({ title: "Updated title" });
  expect(db.user.findFirst).not.toHaveBeenCalled();
  expect(refreshEventSearchStats).not.toHaveBeenCalled();
});

it("leaves unchanged IDs intact without validating historical user roles again", async () => {
  await adminUpdateEvent("event", { organizerId: existing.organizerId, venueId: existing.venueId });
  expect(db.event.update.mock.calls[0][0].data).toEqual({});
  expect(db.user.findFirst).not.toHaveBeenCalled();
});

it("removes the venue and its stale location when explicitly cleared", async () => {
  await adminUpdateEvent("event", { venueId: null });
  expect(db.event.update.mock.calls[0][0].data).toEqual({ venueId: null, city: null, state: null, country: null });
});

it.each([
  [{ organizerId: "" }, "INVALID_ORGANIZER"],
  [{ organizerId: null }, "INVALID_ORGANIZER"],
  [{ venueId: "not-a-uuid" }, "INVALID_VENUE"],
])("rejects invalid assignment IDs before writing", async (body, error) => {
  await expect(adminUpdateEvent("event", body)).resolves.toEqual(expect.objectContaining({ error }));
  expect(db.event.update).not.toHaveBeenCalled();
  expect(db.user.findFirst).not.toHaveBeenCalled();
});

it.each([
  [{ organizerId }, "INVALID_ORGANIZER"],
  [{ venueId }, "INVALID_VENUE"],
])("rejects missing users or users with the wrong role", async (body, error) => {
  db.user.findFirst.mockResolvedValue(null);
  await expect(adminUpdateEvent("event", body)).resolves.toEqual(expect.objectContaining({ error, message: expect.any(String) }));
  expect(db.event.update).not.toHaveBeenCalled();
});

it("loads organizer and venue contact details when reopening an event", async () => {
  await adminGetEventById("event");
  const { include } = db.event.findUnique.mock.calls[0][0];
  expect(include.organizer.select).toEqual(expect.objectContaining({ organizationName: true, businessEmail: true, phone: true }));
  expect(include.venue.select).toEqual(expect.objectContaining({ venueAddress: true, venuePhone: true, venueCountry: true, maxCapacity: true }));
});
