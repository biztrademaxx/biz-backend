import { getDisplayName, nameFromEmailLocalPart } from "../../src/utils/display-name";

describe("nameFromEmailLocalPart", () => {
  it("uses the local-part before @ from any domain", () => {
    expect(nameFromEmailLocalPart("john.doe@gmail.com")).toBe("John Doe");
    expect(nameFromEmailLocalPart("maxxmedia@biztradefairs.com")).toBe("Maxxmedia");
    expect(nameFromEmailLocalPart("venue_expo+nyc@outlook.com")).toBe("Venue Expo Nyc");
  });

  it("returns empty for missing email", () => {
    expect(nameFromEmailLocalPart("")).toBe("");
    expect(nameFromEmailLocalPart(null)).toBe("");
  });
});

describe("getDisplayName", () => {
  it("prefers venueName for venue managers", () => {
    expect(
      getDisplayName({
        role: "VENUE_MANAGER",
        firstName: "Venue",
        lastName: "Manager",
        venueName: "John Doe",
      }),
    ).toBe("John Doe");
  });
});
