/**
 * Postgres full-text search helpers for events (Phase 3).
 */

import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { RANKING_WEIGHTS } from "./event-ranking";

/** Empirical cap so ts_rank_cd maps roughly into [0, 1]. */
const TS_RANK_CAP = 0.4;

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function normalizeRelevanceFromTsRank(rank: number): number {
  return clamp01(rank / TS_RANK_CAP);
}

/**
 * FTS candidate retrieval: id → normalized relevance [0,1].
 * Falls back to empty map on error (caller may use ILIKE).
 */
export async function fetchEventFtsRelevanceMap(
  query: string,
  limit = 2000,
): Promise<Map<string, number>> {
  const trimmed = query.trim();
  const out = new Map<string, number>();
  if (trimmed.length < 2) return out;

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT e.id::text AS id,
             ts_rank_cd(e.search_vector, plainto_tsquery('english', ${trimmed})) AS rank
      FROM events e
      WHERE e.search_vector @@ plainto_tsquery('english', ${trimmed})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;
    for (const row of rows) {
      out.set(row.id, normalizeRelevanceFromTsRank(Number(row.rank)));
    }
  } catch (err) {
    console.error("fetchEventFtsRelevanceMap:", err);
  }
  return out;
}

/** Navbar / typeahead: FTS event hits ordered by rank then startDate. */
export async function searchPublishedEventsByFts(query: string, limit: number) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    return await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        slug: string;
        startDate: Date;
        isVIP: boolean | null;
        isFeatured: boolean | null;
        venueCity: string | null;
        venueCountry: string | null;
        rank: number;
      }>
    >`
      SELECT e.id::text AS id,
             e.title,
             e.slug,
             e."startDate",
             e."isVIP",
             e."isFeatured",
             v."venueCity" AS "venueCity",
             v."venueCountry" AS "venueCountry",
             ts_rank_cd(e.search_vector, plainto_tsquery('english', ${trimmed})) AS rank
      FROM events e
      LEFT JOIN users v ON v.id = e."venueId"
      INNER JOIN users o ON o.id = e."organizerId"
      WHERE e.status = 'PUBLISHED'
        AND e."isPublic" = true
        AND o."isActive" = true
        AND o."isVerified" = true
        AND (o."profileVisibility" IS DISTINCT FROM 'private')
        AND (
          e."venueId" IS NULL
          OR (
            v."isVerified" = true
            AND (v."profileVisibility" IS DISTINCT FROM 'private')
          )
        )
        AND e.search_vector @@ plainto_tsquery('english', ${trimmed})
      ORDER BY rank DESC, e."startDate" ASC
      LIMIT ${limit}
    `;
  } catch (err) {
    console.error("searchPublishedEventsByFts:", err);
    return null;
  }
}

/** Combine precomputed base rankScore (no relevance) with live S_rel. */
export function finalScoreWithRelevance(baseRankScore: number, relevanceScore: number): number {
  // baseRankScore already = 0.50·sub + 0.10·pop + 0.10·trend + 0.05·fresh
  return clamp01(baseRankScore + RANKING_WEIGHTS.relevance * relevanceScore);
}

export type RankedCandidate = {
  id: string;
  startDate: Date;
  /** platinum=3, gold=2, silver=1, free/other=0 — hard preference over score. */
  planTierRank: number;
  baseRankScore: number;
  relevanceScore: number;
  finalScore: number;
};

/** Hard listing preference: platinum → gold → silver → free. */
export function planTierSortRank(tier: string | null | undefined): number {
  switch ((tier || "").toLowerCase()) {
    case "platinum":
      return 3;
    case "gold":
      return 2;
    case "silver":
      return 1;
    default:
      return 0;
  }
}

/**
 * Ranked listing order:
 * 1) organizer plan tier (platinum → gold → silver → free)
 * 2) nearest start date
 * 3) finalScore / rankScore
 */
export function sortRankedCandidates(rows: RankedCandidate[]): RankedCandidate[] {
  return [...rows].sort((a, b) => {
    if (b.planTierRank !== a.planTierRank) return b.planTierRank - a.planTierRank;
    const t = a.startDate.getTime() - b.startDate.getTime();
    if (t !== 0) return t;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return a.id.localeCompare(b.id);
  });
}

/** Guard for Prisma.Sql fragments if needed later. */
export function ftsPlainQuery(sql: string): Prisma.Sql {
  return Prisma.sql`${sql}`;
}
