type UserLocationSource = {
  role?: string | null;
  profileCity?: string | null;
  profileState?: string | null;
  profileCountry?: string | null;
  organizerCity?: string | null;
  organizerState?: string | null;
  organizerCountry?: string | null;
  location?: string | null;
  headquarters?: string | null;
};

export type UserCityCountry = {
  city: string;
  country: string;
  /** "City, Country" for display */
  display: string;
};

export function resolveUserCityCountry(user: UserLocationSource | null | undefined): UserCityCountry {
  if (!user) return { city: "", country: "", display: "" };

  const role = String(user.role ?? "").toUpperCase();
  let city = "";
  let country = "";

  if (role === "ORGANIZER") {
    city = String(user.organizerCity ?? "").trim();
    country = String(user.organizerCountry ?? "").trim();
  } else {
    city = String(user.profileCity ?? "").trim();
    country = String(user.profileCountry ?? "").trim();
  }

  if (!city && !country) {
    const raw = String(user.location ?? user.headquarters ?? "").trim();
    if (raw) {
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        city = parts[0] ?? "";
        country = parts[parts.length - 1] ?? "";
      } else if (parts.length === 2) {
        city = parts[0] ?? "";
        country = parts[1] ?? "";
      } else if (parts.length === 1) {
        city = parts[0] ?? "";
      }
    }
  }

  const display = [city, country].filter(Boolean).join(", ");
  return { city, country, display };
}

type VenueLocationSource = {
  venueCity?: string | null;
  venueState?: string | null;
  venueCountry?: string | null;
  venueAddress?: string | null;
  location?: string | null;
};

export function resolveVenueCityCountry(
  venue: VenueLocationSource | null | undefined,
  appointmentLocation?: string | null
): UserCityCountry {
  let city = String(venue?.venueCity ?? "").trim();
  let country = String(venue?.venueCountry ?? "").trim();

  if (!city && !country) {
    const raw = String(
      appointmentLocation ?? venue?.venueAddress ?? venue?.location ?? ""
    ).trim();
    if (raw) {
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        city = parts[0] ?? "";
        country = parts[parts.length - 1] ?? "";
      } else if (parts.length === 2) {
        city = parts[0] ?? "";
        country = parts[1] ?? "";
      } else if (parts.length === 1) {
        city = parts[0] ?? "";
      }
    }
  }

  const display = [city, country].filter(Boolean).join(", ");
  return { city, country, display };
}

type EventLocationSource = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  venue?: (VenueLocationSource & { venueName?: string | null }) | null;
};

export function resolveEventCityCountry(
  event: EventLocationSource | null | undefined
): UserCityCountry & { state: string; venueName: string } {
  if (!event) return { city: "", state: "", country: "", display: "", venueName: "" };

  const city = String(event.city ?? event.venue?.venueCity ?? "").trim();
  const state = String(event.state ?? event.venue?.venueState ?? "").trim();
  const country = String(event.country ?? event.venue?.venueCountry ?? "").trim();
  const venueName = String(event.venue?.venueName ?? "").trim();
  const display = [city, country].filter(Boolean).join(", ");

  return { city, state, country, display, venueName };
}
