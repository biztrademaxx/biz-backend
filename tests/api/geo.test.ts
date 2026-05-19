import express from "express";
import request from "supertest";

import geoRouter from "../../src/modules/geo/geo.routes";
import * as geoService from "../../src/modules/geo/geo.service";

jest.mock("../../src/modules/geo/geo.service");

const mockedService = geoService as jest.Mocked<typeof geoService>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/geo", geoRouter);
  return app;
}

describe("GET /api/geo/visitor", () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns geo from service using request headers", async () => {
    mockedService.resolveVisitorGeo.mockResolvedValue({
      city: "Bengaluru",
      region: "Karnataka",
      countryCode: "IN",
      countryName: "India",
    });

    const res = await request(app)
      .get("/api/geo/visitor")
      .set("x-forwarded-for", "203.0.113.1")
      .expect(200);

    expect(res.body.countryCode).toBe("IN");
    expect(res.body.city).toBe("Bengaluru");
    expect(mockedService.resolveVisitorGeo).toHaveBeenCalled();
  });

  it("returns empty geo when service returns empty", async () => {
    mockedService.resolveVisitorGeo.mockResolvedValue({
      city: null,
      region: null,
      countryCode: null,
      countryName: null,
    });

    const res = await request(app).get("/api/geo/visitor").expect(200);

    expect(res.body.countryCode).toBeNull();
  });
});
