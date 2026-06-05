/** Sort public organizer listings: visitor country first, then home city, then name. */

const CODE_ALIASES: Record<string, string[]> = {
  IN: ["india", "in"],
  US: ["united states", "usa", "us", "america"],
  GB: ["united kingdom", "uk", "great britain"],
  AE: ["united arab emirates", "uae", "ae"],
};

export type OrganizerCountryPriorityInput = {
  countryName?: string;
  countryCode?: string;
  city?: string;
};

function buildCountryNeedles(input: OrganizerCountryPriorityInput): string[] {
  const out = new Set<string>();
  const name = String(input.countryName ?? "").trim().toLowerCase();
  const code = String(input.countryCode ?? "").trim().toUpperCase();
  if (name) out.add(name);
  if (code) {
    out.add(code.toLowerCase());
    for (const alias of CODE_ALIASES[code] ?? []) out.add(alias);
  }
  return [...out];
}

function countryNeedleMatchesHay(hay: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  if (hay === n) return true;
  if (n.length <= 3) {
    const tokens = hay.split(/[\s,./|&()-]+/).filter(Boolean);
    return tokens.some((t) => t === n);
  }
  return hay.includes(n) || n.includes(hay);
}

function fieldMatchesCountry(
  value: string | null | undefined,
  needles: string[],
): boolean {
  const hay = String(value ?? "").trim().toLowerCase();
  if (!hay || needles.length === 0) return false;
  return needles.some((n) => countryNeedleMatchesHay(hay, n));
}

function cityMatches(value: string | null | undefined, city: string): boolean {
  const needle = city.trim().toLowerCase();
  if (!needle) return true;
  const hay = String(value ?? "").trim().toLowerCase();
  if (!hay) return false;
  return hay.includes(needle) || needle.includes(hay);
}

export function organizerMatchesPriorityCountry(
  row: {
    organizerCountry?: string | null;
    organizerCity?: string | null;
    location?: string | null;
    headquarters?: string | null;
  },
  input: OrganizerCountryPriorityInput,
): boolean {
  const needles = buildCountryNeedles(input);
  if (needles.length === 0) return false;
  return (
    fieldMatchesCountry(row.organizerCountry, needles) ||
    fieldMatchesCountry(row.location, needles) ||
    fieldMatchesCountry(row.headquarters, needles)
  );
}

/** Lower score = listed earlier. */
export function organizerCountryPriorityScore(
  row: {
    organizerCountry?: string | null;
    organizerCity?: string | null;
    location?: string | null;
    headquarters?: string | null;
  },
  input: OrganizerCountryPriorityInput,
): number {
  if (!organizerMatchesPriorityCountry(row, input)) return 2;
  const homeCity = String(input.city ?? "").trim();
  if (homeCity && cityMatches(row.organizerCity, homeCity)) return 0;
  if (homeCity && cityMatches(row.location, homeCity)) return 0;
  return 1;
}

type OrganizerLocationRow = {
  id: string;
  organizerCountry?: string | null;
  organizerCity?: string | null;
  location?: string | null;
  headquarters?: string | null;
};

export function sortOrganizerRowsByCountryPriority<T extends OrganizerLocationRow>(
  rows: T[],
  input: OrganizerCountryPriorityInput,
  nameKey: (row: T) => string,
): T[] {
  return [...rows].sort((a, b) => {
    const scoreA = organizerCountryPriorityScore(a, input);
    const scoreB = organizerCountryPriorityScore(b, input);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return nameKey(a).localeCompare(nameKey(b), undefined, { sensitivity: "base" });
  });
}
