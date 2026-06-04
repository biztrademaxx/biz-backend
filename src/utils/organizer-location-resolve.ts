/** Parse "City, State, Country" (or shorter) into organizer location parts. */
export function parseCommaSeparatedLocation(line: string): {
  city: string;
  state: string;
  country: string;
} {
  const parts = line
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      city: parts[0],
      state: parts.slice(1, -1).join(", "),
      country: parts[parts.length - 1],
    };
  }
  if (parts.length === 2) {
    return { city: parts[0], state: "", country: parts[1] };
  }
  if (parts.length === 1) {
    return { city: parts[0], state: "", country: "" };
  }
  return { city: "", state: "", country: "" };
}

export type OrganizerLocationSource = {
  organizerCountry?: string | null;
  organizerState?: string | null;
  organizerCity?: string | null;
  location?: string | null;
  headquarters?: string | null;
  profileCountry?: string | null;
  profileState?: string | null;
  profileCity?: string | null;
};

/** Fill missing organizer* fields from profile / location / headquarters strings. */
export function resolveOrganizerLocationFields(source: OrganizerLocationSource): {
  organizerCountry: string;
  organizerState: string;
  organizerCity: string;
} {
  let organizerCountry = String(source.organizerCountry ?? "").trim();
  let organizerState = String(source.organizerState ?? "").trim();
  let organizerCity = String(source.organizerCity ?? "").trim();

  if (!organizerCountry && !organizerState && !organizerCity) {
    organizerCountry = String(source.profileCountry ?? "").trim();
    organizerState = String(source.profileState ?? "").trim();
    organizerCity = String(source.profileCity ?? "").trim();
  }

  if (!organizerCountry && !organizerState && !organizerCity) {
    const fromLocation = parseCommaSeparatedLocation(String(source.location ?? "").trim());
    organizerCity = fromLocation.city;
    organizerState = fromLocation.state;
    organizerCountry = fromLocation.country;
  }

  if (!organizerCountry && !organizerState && !organizerCity) {
    const fromHq = parseCommaSeparatedLocation(String(source.headquarters ?? "").trim());
    organizerCity = fromHq.city;
    organizerState = fromHq.state;
    organizerCountry = fromHq.country;
  }

  return { organizerCountry, organizerState, organizerCity };
}

/** Accept legacy `country` / `state` / `city` keys on admin create/update bodies. */
export function applyOrganizerLocationBodyAliases(body: Record<string, unknown>): void {
  if (body.organizerCountry === undefined && body.country !== undefined) {
    body.organizerCountry = body.country;
  }
  if (body.organizerState === undefined && body.state !== undefined) {
    body.organizerState = body.state;
  }
  if (body.organizerCity === undefined && body.city !== undefined) {
    body.organizerCity = body.city;
  }
}
