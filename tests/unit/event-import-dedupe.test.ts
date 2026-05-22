import {
  buildImportDuplicateFingerprint,
  duplicateKeyFromFingerprint,
  normalizeImportLabel,
  startOfUtcDay,
} from "../../src/modules/admin/event-import/event-import-dedupe";

describe("event-import dedupe", () => {
  it("normalizes labels for comparison", () => {
    expect(normalizeImportLabel("  Tech   Expo  ")).toBe("tech expo");
    expect(normalizeImportLabel("Bangalore Expo")).toBe("bangalore expo");
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
  });

  it("uses UTC calendar day in duplicate key", () => {
    const d = new Date("2025-05-01T14:30:00.000Z");
    const fp = buildImportDuplicateFingerprint({
      eventTitle: "X",
      startDate: d,
      venueName: "",
    });
    const day = startOfUtcDay(fp.startDate).toISOString().slice(0, 10);
    expect(duplicateKeyFromFingerprint(fp)).toContain(`|${day}|`);
  });
});
