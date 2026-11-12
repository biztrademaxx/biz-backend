import {
  combineDateAndTimeInTimeZone,
  parseCalendarParts,
  parseImportedDateTime,
  parseTimeParts,
  inferImportDateOrder,
} from "../../src/modules/admin/event-import/event-import-parse";

describe("event-import-parse", () => {
  it("parses DD-MM-YYYY dashed dates (01-08-2026)", () => {
    const parts = parseCalendarParts("01-08-2026");
    expect(parts).toEqual({ year: 2026, month: 8, day: 1 });
  });

  it("preserves the calendar day of a valid Excel Date object", () => {
    expect(parseCalendarParts(new Date(Date.UTC(2026, 0, 8)))).toEqual({ year: 2026, month: 1, day: 8 });
  });

  it("parses import row dates as Aug 1 – Aug 3 2026", () => {
    const start = parseImportedDateTime("01-08-2026", "10:20", "10:00", "Asia/Kolkata");
    const end = parseImportedDateTime("03-08-2026", "18:20", "18:00", "Asia/Kolkata");
    const dateFmt: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    };
    expect(start.toLocaleDateString("en-IN", dateFmt)).toContain("1 Aug");
    expect(end.toLocaleDateString("en-IN", dateFmt)).toContain("3 Aug");
  });

  it("parses YYYY-MM-DD dates", () => {
    const parts = parseCalendarParts("2026-08-03");
    expect(parts).toEqual({ year: 2026, month: 8, day: 3 });
  });

  it("parses Excel short slashed dates (2/6/26) as DD/MM", () => {
    const parts = parseCalendarParts("2/6/26");
    expect(parts).toEqual({ year: 2026, month: 6, day: 2 });
  });

  it("parses slashed dates with 4-digit year (02/06/2026)", () => {
    const parts = parseCalendarParts("02/06/2026");
    expect(parts).toEqual({ year: 2026, month: 6, day: 2 });
  });

  it("parses Excel serial numbers as strings", () => {
    const parts = parseCalendarParts("45292");
    expect(parts).not.toBeNull();
    expect(parts!.year).toBeGreaterThanOrEqual(2020);
  });

  it("parses HH:mm:ss times", () => {
    expect(parseTimeParts("10:20:00", "10:00")).toEqual({ hours: 10, minutes: 20 });
    expect(parseTimeParts("18:20:00", "18:00")).toEqual({ hours: 18, minutes: 20 });
  });

  it("stores wall time in Asia/Kolkata for display", () => {
    const start = parseImportedDateTime("01-08-2026", "10:20:00", "10:00", "Asia/Kolkata");
    const end = parseImportedDateTime("03-08-2026", "18:20:00", "18:00", "Asia/Kolkata");

    const fmt: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };
    expect(start.toLocaleTimeString("en-IN", fmt)).toMatch(/10:20/i);
    expect(end.toLocaleTimeString("en-IN", fmt)).toMatch(/6:20|18:20/i);

    expect(start.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })).toContain("Aug");
    expect(end.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })).toContain("Aug");
  });

  it("combineDateAndTimeInTimeZone matches desired wall clock", () => {
    const utc = combineDateAndTimeInTimeZone(
      { year: 2026, month: 8, day: 1 },
      { hours: 10, minutes: 20 },
      "Asia/Kolkata",
    );
    expect(utc.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })).toBe("10:20");
  });
});

it("uses file-wide MM/DD evidence for both ambiguous and unambiguous dates", () => {
  const order = inferImportDateOrder([{ startDate: "06/11/2026", endDate: "6/13/2026" }]);
  expect(order).toBe("MDY");
  expect(parseCalendarParts("06/11/2026", order)).toEqual({ year: 2026, month: 6, day: 11 });
  expect(parseCalendarParts("6/13/2026", order)).toEqual({ year: 2026, month: 6, day: 13 });
});
it("keeps DD/MM files consistent and rejects mixed conventions", () => {
  expect(inferImportDateOrder([{ startDate: "13/06/2026", endDate: "16/06/2026" }])).toBe("DMY");
  expect(() => inferImportDateOrder([{ startDate: "13/06/2026", endDate: "6/16/2026" }])).toThrow("Mixed");
  expect(parseCalendarParts("6/16/2026", "DMY")).toBeNull();
});
