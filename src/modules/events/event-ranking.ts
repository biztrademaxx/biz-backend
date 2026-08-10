/**
 * Event listing ranking (Phase 3).
 * FinalScore = 0.50·S_sub + 0.25·S_rel + 0.10·S_pop + 0.10·S_trend + 0.05·S_fresh
 * Precomputed EventSearchStats.rankScore omits S_rel (query-dependent); listing adds it live.
 */

export const RANKING_VERSION = "v1";

export type OrganizerPlanTier = "free" | "silver" | "gold" | "platinum";

export const RANKING_WEIGHTS = {
  subscription: 0.5,
  relevance: 0.25,
  popularity: 0.1,
  trending: 0.1,
  freshness: 0.05,
} as const;

/** Soft saturation for log-scaled popularity / trending. */
const POPULARITY_K = 8;
const TRENDING_K = 5;
/** Freshness half-life-ish decay in days. */
const FRESHNESS_LAMBDA_DAYS = 45;

export function tierFromPlanSlug(planSlug: string | null | undefined): OrganizerPlanTier {
  if (!planSlug) return "free";
  const slug = planSlug.toLowerCase();
  if (slug.includes("platinum")) return "platinum";
  if (slug.includes("gold")) return "gold";
  if (slug.includes("silver")) return "silver";
  return "free";
}

export function subscriptionScoreFromTier(tier: OrganizerPlanTier | string): number {
  switch (tier) {
    case "platinum":
      return 1;
    case "gold":
      return 0.75;
    case "silver":
      return 0.5;
    case "free":
    default:
      return 0.15;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function softSat(raw: number, k: number): number {
  if (raw <= 0) return 0;
  return raw / (raw + k);
}

export function popularityScoreFromCounts(input: {
  followersCount: number;
  confirmedRegsCount: number;
  listingClicks: number;
  averageRating: number;
}): number {
  const followers = Math.max(0, input.followersCount || 0);
  const regs = Math.max(0, input.confirmedRegsCount || 0);
  const clicks = Math.max(0, input.listingClicks || 0);
  const ratingNorm = clamp01((input.averageRating || 0) / 5);

  const raw =
    0.35 * Math.log1p(followers) +
    0.35 * Math.log1p(regs) +
    0.2 * Math.log1p(clicks) +
    0.1 * ratingNorm;

  return clamp01(softSat(raw, POPULARITY_K));
}

export function trendingScoreFromWindows(input: {
  saves7d: number;
  regs7d: number;
  clicks7d: number;
}): number {
  const raw =
    Math.log1p(Math.max(0, input.saves7d || 0)) +
    Math.log1p(Math.max(0, input.regs7d || 0)) +
    Math.log1p(Math.max(0, input.clicks7d || 0));
  return clamp01(softSat(raw, TRENDING_K));
}

export function freshnessScoreFromDates(input: {
  createdAt: Date;
  startDate: Date;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const ageMs = Math.max(0, now.getTime() - input.createdAt.getTime());
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const listingFresh = Math.exp(-ageDays / FRESHNESS_LAMBDA_DAYS);

  const msUntilStart = input.startDate.getTime() - now.getTime();
  const daysUntilStart = msUntilStart / (24 * 60 * 60 * 1000);
  let soon = 0;
  if (daysUntilStart >= 0 && daysUntilStart <= 30) {
    soon = 1 - daysUntilStart / 30;
  } else if (daysUntilStart < 0 && daysUntilStart >= -1) {
    soon = 0.3;
  }

  return clamp01(0.6 * listingFresh + 0.4 * soon);
}

export function computeRankScore(parts: {
  subscriptionScore: number;
  relevanceScore?: number;
  popularityScore: number;
  trendingScore?: number;
  freshnessScore: number;
}): number {
  const sRel = parts.relevanceScore ?? 0;
  const sTrend = parts.trendingScore ?? 0;
  return clamp01(
    RANKING_WEIGHTS.subscription * parts.subscriptionScore +
      RANKING_WEIGHTS.relevance * sRel +
      RANKING_WEIGHTS.popularity * parts.popularityScore +
      RANKING_WEIGHTS.trending * sTrend +
      RANKING_WEIGHTS.freshness * parts.freshnessScore,
  );
}
