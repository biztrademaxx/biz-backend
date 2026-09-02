import {
  buildImportDuplicateFingerprint,
  duplicateKeyFromFingerprint,
  eventMatchesFingerprint,
  normalizeImportLabel,
  venuesAreDistinctEdition,
} from "../../src/modules/admin/event-import/event-import-dedupe";

describe("event-import dedupe", () => {
  it("normalizes labels for comparison", () => {
    expect(normalizeImportLabel("  Tech   Expo  ")).toBe("tech expo");
    expect(normalizeImportLabel("Bangalore Expo")).toBe("bangalore expo");
    expect(normalizeImportLabel("Tech-Expo!")).toBe("tech expo");
  });

  it("treats same title+date+venue as one duplicate key", () => {
    const row = {
      eventTitle: "Tech Expo",
      startDate: "2025-05-01",
      startTime: "10:00",
      venueName: "Bangalore Expo",
    };
    const fp1 = buildImportDuplicateFingerprint(row);
    const fp2 = buildImportDuplicateFingerprint({
      ...row,
      eventTitle: "  tech expo  ",
      venueName: "bangalore expo",
    });
    expect(duplicateKeyFromFingerprint(fp1)).toBe(duplicateKeyFromFingerprint(fp2));
  });

  it("keeps the spreadsheet calendar day for IST (not UTC)", () => {
    const fp = buildImportDuplicateFingerprint({
      eventTitle: "Tech Expo",
      startDate: "01-08-2026",
      startTime: "00:30",
      timezone: "Asia/Kolkata",
      venueName: "",
    });
    expect(fp.calendarDay).toBe("2026-08-01");
    expect(duplicateKeyFromFingerprint(fp)).toContain("|2026-08-01|");
  });

  it("allows same title and venue on different start dates", () => {
    const key2025 = duplicateKeyFromFingerprint(
      buildImportDuplicateFingerprint({
        eventTitle: "Tech Expo",
        startDate: "2025-05-01",
        venueName: "Bangalore Expo",
      }),
    );
    const key2026 = duplicateKeyFromFingerprint(
      buildImportDuplicateFingerprint({
        eventTitle: "Tech Expo",
        startDate: "2026-05-01",
        venueName: "Bangalore Expo",
      }),
    );
    expect(key2025).not.toBe(key2026);
  });

  it("allows same title and date at different venues", () => {
    const bangalore = duplicateKeyFromFingerprint(
      buildImportDuplicateFingerprint({
        eventTitle: "Tech Expo",
        startDate: "2025-05-01",
        venueName: "Bangalore Expo",
      }),
    );
    const mumbai = duplicateKeyFromFingerprint(
      buildImportDuplicateFingerprint({
        eventTitle: "Tech Expo",
        startDate: "2025-05-01",
        venueName: "Mumbai Expo",
      }),
    );
    expect(bangalore).not.toBe(mumbai);
    expect(
      venuesAreDistinctEdition("bangalore expo", "mumbai expo"),
    ).toBe(true);
  });

  it("treats missing venue as the same event on re-upload", () => {
    expect(venuesAreDistinctEdition("bangalore expo", "")).toBe(false);
    expect(venuesAreDistinctEdition("", "")).toBe(false);

    const fp = buildImportDuplicateFingerprint({
      eventTitle: "Tech Expo",
      startDate: "2025-05-01",
      startTime: "10:00",
      timezone: "Asia/Kolkata",
      venueName: "Bangalore Expo",
    });
    const stored = new Date("2025-05-01T04:30:00.000Z");
    expect(
      eventMatchesFingerprint(
        {
          title: "Tech Expo",
          startDate: stored,
          timezone: "Asia/Kolkata",
          city: null,
          venue: null,
        },
        fp,
      ),
    ).toBe(true);
  });

  it("does not treat a different named venue as a duplicate", () => {
    const fp = buildImportDuplicateFingerprint({
      eventTitle: "Tech Expo",
      startDate: "2025-05-01",
      startTime: "10:00",
      timezone: "Asia/Kolkata",
      venueName: "Bangalore Expo",
    });
    expect(
      eventMatchesFingerprint(
        {
          title: "Tech Expo",
          startDate: new Date("2025-05-01T04:30:00.000Z"),
          timezone: "Asia/Kolkata",
          venue: { venueName: "Mumbai Expo" },
        },
        fp,
      ),
    ).toBe(false);
  });

  it("uses the spreadsheet calendar day in the duplicate key", () => {
    const d = new Date("2025-05-01T14:30:00.000Z");
    const fp = buildImportDuplicateFingerprint({
      eventTitle: "X",
      startDate: d,
      venueName: "",
    });
    expect(duplicateKeyFromFingerprint(fp)).toContain("|2025-05-01|");
  });
});
