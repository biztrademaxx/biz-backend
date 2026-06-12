import { createHash } from "crypto";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

export function isRedisEnabled(): boolean {
  return redis !== null;
}

/** Stable short hash for cache keys from query/param objects. */
export function hashCacheParams(params: Record<string, unknown>): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

const CACHE_VERSION_KEYS = {
  eventsList: "cache:ver:events:list",
  eventsStats: "cache:ver:events:stats",
} as const;

async function getCacheVersion(versionKey: string): Promise<number> {
  if (!redis) return 1;
  try {
    const v = await redis.get<number>(versionKey);
    return typeof v === "number" && v > 0 ? v : 1;
  } catch {
    return 1;
  }
}

async function bumpCacheVersion(versionKey: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.incr(versionKey);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[redis] version bump failed for ${versionKey}:`, error);
  }
}

/** Read-through cache: returns cached JSON or runs `fn` and stores the result. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (!redis) {
    return fn();
  }

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) {
      return hit;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[redis] cache get failed for ${key}:`, error);
  }

  const data = await fn();

  try {
    await redis.set(key, data, { ex: ttlSeconds });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[redis] cache set failed for ${key}:`, error);
  }

  return data;
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[redis] cache del failed:`, error);
  }
}

/** Build a versioned events list cache key (invalidated via version bump). */
export async function eventsListCacheKey(params: Record<string, unknown>): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.eventsList);
  return `events:list:v${version}:${hashCacheParams(params)}`;
}

/** Build a versioned events stats cache key. */
export async function eventsStatsCacheKey(include: string): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.eventsStats);
  return `events:stats:v${version}:${include}`;
}

/**
 * Invalidate cached event/organizer/stats responses after writes.
 * Uses version bumps for list/stats keys so we avoid SCAN/KEYS in production.
 */
export async function invalidateEventCaches(opts?: { slug?: string }): Promise<void> {
  const keysToDelete = [
    CACHE_KEYS.organizersFacets(),
    CACHE_KEYS.adminEventsStats(),
    CACHE_KEYS.eventsCategoriesBrowse(),
    CACHE_KEYS.eventsVip(),
    CACHE_KEYS.eventsFeatured(),
    ...(opts?.slug ? [CACHE_KEYS.eventDetail(opts.slug)] : []),
  ];

  await Promise.all([
    bumpCacheVersion(CACHE_VERSION_KEYS.eventsList),
    bumpCacheVersion(CACHE_VERSION_KEYS.eventsStats),
    cacheDel(...keysToDelete),
  ]);
}

export const CACHE_TTL = {
  EVENTS_LIST: 60,
  EVENTS_VIP: 120,
  EVENTS_FEATURED: 120,
  ORGANIZERS_FACETS: 300,
  ADMIN_EVENTS_STATS: 120,
  EVENTS_STATS: 300,
  EVENTS_CATEGORIES_BROWSE: 300,
} as const;

export const CACHE_KEYS = {
  organizersFacets: () => "organizers:facets",
  adminEventsStats: () => "admin:events:stats",
  eventsCategoriesBrowse: () => "events:categories:browse",
  eventsVip: () => "events:vip",
  eventsFeatured: () => "events:featured",
  eventDetail: (slug: string) => `event:detail:${slug}`,
} as const;
