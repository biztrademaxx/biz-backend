jest.mock("../../src/config/prisma");

import request from "supertest";

import { createApp } from "../../src/app";

describe("Express API", () => {
  const app = createApp();

  describe("GET /health", () => {
    it("responds 200 with status ok", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body).toEqual({ status: "ok" });
      expect(res.headers["content-type"]).toMatch(/json/);
    });
  });

  describe("GET /api/ (example route)", () => {
    it("returns the public API root message", async () => {
      const res = await request(app).get("/api/").expect(200);
      expect(res.body).toEqual({ message: "ok" });
    });
  });
});
