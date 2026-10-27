import express, { type Request } from "express";
import request from "supertest";
import prisma from "../../src/config/prisma";
import { invalidateEventCaches } from "../../src/config/redis";
import { patchEventByIdHandler } from "../../src/modules/events/events.controller";

jest.mock("../../src/config/prisma", () => ({
  __esModule: true,
  default: { event: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock("../../src/config/redis", () => ({ invalidateEventCaches: jest.fn().mockResolvedValue(undefined) }));

const db = prisma as unknown as {
  event: { findUnique: jest.Mock; update: jest.Mock };
};
const bannerUrl = "https://example.com/event-banner.png";
const auth: NonNullable<Request["auth"]> = { sub: "organizer-1", role: "ORGANIZER", domain: "USER" };

function buildApp(actor: Request["auth"] = auth) {
  const app = express();
  app.use(express.json());
  app.patch("/api/events/:id", (req, res, next) => {
    req.auth = actor;
    void patchEventByIdHandler(req, res).catch(next);
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  db.event.findUnique.mockResolvedValue({ id: "event-1", organizerId: "organizer-1" });
  db.event.update.mockImplementation(async ({ data }) => ({ id: "event-1", slug: "automation-expo", ...data }));
});

it("persists the organizer's banner and invalidates public event caches", async () => {
  const response = await request(buildApp()).patch("/api/events/event-1").send({ bannerImage: bannerUrl }).expect(200);
  expect(response.body.bannerImage).toBe(bannerUrl);
  expect(db.event.update).toHaveBeenCalledWith(expect.objectContaining({
    data: { bannerImage: bannerUrl },
    select: expect.objectContaining({ bannerImage: true }),
  }));
  expect(invalidateEventCaches).toHaveBeenCalledWith({ id: "event-1", slug: "automation-expo" });
});

it("clears the banner when the organizer removes it", async () => {
  const response = await request(buildApp()).patch("/api/events/event-1").send({ bannerImage: null }).expect(200);
  expect(response.body.bannerImage).toBeNull();
  expect(db.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: { bannerImage: null } }));
});

it("retains the existing banner when updating other event fields", async () => {
  await request(buildApp()).patch("/api/events/event-1").send({ images: ["/gallery.png"] }).expect(200);
  expect(db.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: { images: ["/gallery.png"] } }));
});

it("rejects anonymous banner edits", async () => {
  await request(buildApp(null)).patch("/api/events/event-1").send({ bannerImage: bannerUrl }).expect(401);
  expect(db.event.update).not.toHaveBeenCalled();
});

it("rejects edits by another organizer", async () => {
  await request(buildApp({ ...auth, sub: "another-organizer" })).patch("/api/events/event-1").send({ bannerImage: bannerUrl }).expect(403);
  expect(db.event.update).not.toHaveBeenCalled();
});

it("allows an admin to update a banner", async () => {
  await request(buildApp({ ...auth, sub: "admin-1", role: "SUPER_ADMIN", domain: "ADMIN" })).patch("/api/events/event-1").send({ bannerImage: bannerUrl }).expect(200);
  expect(db.event.update).toHaveBeenCalled();
});

it("rejects invalid banner values", async () => {
  await request(buildApp()).patch("/api/events/event-1").send({ bannerImage: 123 }).expect(400);
  expect(db.event.update).not.toHaveBeenCalled();
});

it("returns 404 when the event is missing", async () => {
  db.event.findUnique.mockResolvedValue(null);
  await request(buildApp()).patch("/api/events/missing").send({ bannerImage: bannerUrl }).expect(404);
  expect(db.event.update).not.toHaveBeenCalled();
});
