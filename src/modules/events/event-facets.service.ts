/**
 * Global facet counts for /event sidebar (Phase 4 polish).
 * Counts published public events only — not filtered by active UI filters
 * (filter-aware facets can come later).
 */

import prisma from "../../config/prisma";
import { cached, CACHE_KEYS, CACHE_TTL, cacheDel } from "../../config/redis";

export type FacetNameCount = { name: string; count: number };

export type EventListingFacets = {
  categories: FacetNameCount[];
  /** @deprecated Prefer `cities` — kept for older clients */
  locations: FacetNameCount[];
  cities: FacetNameCount[];
  countries: FacetNameCount[];
  formats: FacetNameCount[];
  totalEvents: number;
};

function formatLabel(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (u === "CONFERENCE" || raw.toLowerCase() === "conference") return "Conference";
  if (u === "EXHIBITION" || raw.toLowerCase() === "exhibition") return "Exhibition";
  if (u === "SEMINAR" || raw.toLowerCase() === "seminar") return "Seminar";
  if (u === "WORKSHOP" || raw.toLowerCase() === "workshop" || raw.toLowerCase() === "workshops") {
    return "Workshops";
  }
  return raw.trim();
}

async function getEventListingFacetsFromDb(excludePast: boolean): Promise<EventListingFacets> {
  const categoryRows = excludePast
    ? await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(c) AS name, COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        CROSS JOIN LATERAL unnest(e.category) AS c
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND e."endDate" >= CURRENT_DATE
          AND TRIM(c) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 60
      `
    : await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(c) AS name, COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        CROSS JOIN LATERAL unnest(e.category) AS c
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND TRIM(c) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 60
      `;

  const locationRows = excludePast
    ? await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(COALESCE(NULLIF(v."venueCity", ''), NULLIF(e.city, ''))) AS name,
               COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        LEFT JOIN users v ON v.id = e."venueId"
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND e."endDate" >= CURRENT_DATE
          AND TRIM(COALESCE(NULLIF(v."venueCity", ''), NULLIF(e.city, ''))) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 200
      `
    : await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(COALESCE(NULLIF(v."venueCity", ''), NULLIF(e.city, ''))) AS name,
               COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        LEFT JOIN users v ON v.id = e."venueId"
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND TRIM(COALESCE(NULLIF(v."venueCity", ''), NULLIF(e.city, ''))) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 200
      `;

  const countryRows = excludePast
    ? await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(COALESCE(NULLIF(v."venueCountry", ''), NULLIF(e.country, ''))) AS name,
               COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        LEFT JOIN users v ON v.id = e."venueId"
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND e."endDate" >= CURRENT_DATE
          AND TRIM(COALESCE(NULLIF(v."venueCountry", ''), NULLIF(e.country, ''))) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 200
      `
    : await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(COALESCE(NULLIF(v."venueCountry", ''), NULLIF(e.country, ''))) AS name,
               COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        LEFT JOIN users v ON v.id = e."venueId"
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND TRIM(COALESCE(NULLIF(v."venueCountry", ''), NULLIF(e.country, ''))) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 200
      `;

  const formatRows = excludePast
    ? await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(t) AS name, COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        CROSS JOIN LATERAL unnest(e."eventType") AS t
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND e."endDate" >= CURRENT_DATE
          AND TRIM(t) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 40
      `
    : await prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT TRIM(t) AS name, COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        CROSS JOIN LATERAL unnest(e."eventType") AS t
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND TRIM(t) <> ''
        GROUP BY 1
        ORDER BY count DESC, name ASC
        LIMIT 40
      `;

  const totalRow = excludePast
    ? await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
          AND e."endDate" >= CURRENT_DATE
      `
    : await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM events e
        INNER JOIN users o ON o.id = e."organizerId"
        WHERE e.status = 'PUBLISHED'
          AND e."isPublic" = true
          AND o."isActive" = true
          AND o."isVerified" = true
          AND (o."profileVisibility" IS DISTINCT FROM 'private')
      `;

  const formatMap = new Map<string, number>();
  for (const row of formatRows) {
    const label = formatLabel(row.name);
    formatMap.set(label, (formatMap.get(label) ?? 0) + Number(row.count));
  }
  const formats = Array.from(formatMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const totalEvents = Number(totalRow[0]?.count ?? 0);
  const cities = locationRows.map((r) => ({ name: r.name, count: Number(r.count) }));
  const countries = countryRows.map((r) => ({ name: r.name, count: Number(r.count) }));

  return {
    categories: categoryRows.map((r) => ({ name: r.name, count: Number(r.count) })),
    locations: cities,
    cities,
    countries,
    formats: [{ name: "All Formats", count: totalEvents }, ...formats],
    totalEvents,
  };
}

export async function getEventListingFacets(options?: { excludePast?: boolean }) {
  const excludePast = options?.excludePast !== false;
  const key = CACHE_KEYS.eventsFacets(excludePast ? "future:v2" : "all:v2");
  return cached(key, CACHE_TTL.EVENTS_FACETS, () => getEventListingFacetsFromDb(excludePast));
}

export async function invalidateEventFacetsCache() {
  await cacheDel(
    CACHE_KEYS.eventsFacets("future"),
    CACHE_KEYS.eventsFacets("all"),
    CACHE_KEYS.eventsFacets("future:v2"),
    CACHE_KEYS.eventsFacets("all:v2")
  );
}
