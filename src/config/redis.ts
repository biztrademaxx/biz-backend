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

function normalizeDetailKey(segment: string): string {
  return segment.trim().toLowerCase();
}

const CACHE_VERSION_KEYS = {
  eventsList: "cache:ver:events:list",
  eventsStats: "cache:ver:events:stats",
  organizersList: "cache:ver:organizers:list",
  organizersFacets: "cache:ver:organizers:facets",
  organizerEvents: "cache:ver:organizer:events",
  adminEventsList: "cache:ver:admin:events",
  adminOrganizersList: "cache:ver:admin:organizers",
  venuesList: "cache:ver:venues:list",
  speakersList: "cache:ver:speakers:list",
  search: "cache:ver:search",
  geo: "cache:ver:geo",
  banners: "cache:ver:content:banners",
} as const;

const DASHBOARD_RANGES = ["1m", "3m", "1y"] as const;

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

export async function eventsListCacheKey(params: Record<string, unknown>): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.eventsList);
  return `events:list:v${version}:${hashCacheParams(params)}`;
}

export async function eventsStatsCacheKey(include: string): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.eventsStats);
  return `events:stats:v${version}:${include}`;
}

export async function organizersListCacheKey(params: Record<string, unknown>): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.organizersList);
  return `organizers:list:v${version}:${hashCacheParams(params)}`;
}

export async function organizersFacetsCacheKey(): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.organizersFacets);
  return `organizers:facets:v${version}`;
}

export async function organizerEventsCacheKey(
  organizerKey: string,
  page: number,
  limit: number,
): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.organizerEvents);
  return `organizer:events:v${version}:${normalizeDetailKey(organizerKey)}:${page}:${limit}`;
}

export async function adminEventsListCacheKey(params: Record<string, unknown>): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.adminEventsList);
  return `admin:events:v${version}:${hashCacheParams(params)}`;
}

export async function adminOrganizersListCacheKey(params: Record<string, unknown>): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.adminOrganizersList);
  return `admin:organizers:v${version}:${hashCacheParams(params)}`;
}

export async function venuesListCacheKey(params: Record<string, unknown>): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.venuesList);
  return `venues:list:v${version}:${hashCacheParams(params)}`;
}

export async function speakersListCacheKey(requireProfileImage: boolean): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.speakersList);
  return `speakers:list:v${version}:${requireProfileImage ? "img" : "all"}`;
}

export async function searchCacheKey(query: string, limit: number): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.search);
  const q = query.trim().toLowerCase();
  return `search:v${version}:${hashCacheParams({ q, limit })}`;
}

export async function geoCitiesCacheKey(countryId?: string): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.geo);
  return `geo:cities:v${version}:${countryId?.trim() || "all"}`;
}

export async function geoCountriesCacheKey(): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.geo);
  return `geo:countries:v${version}`;
}

export async function bannersCacheKey(page?: string, position?: string): Promise<string> {
  const version = await getCacheVersion(CACHE_VERSION_KEYS.banners);
  return `content:banners:v${version}:${page || "_"}:${position || "_"}`;
}

function adminDashboardKeysToDelete(): string[] {
  return DASHBOARD_RANGES.flatMap((range) => [
    CACHE_KEYS.adminDashboard(range),
    CACHE_KEYS.adminEventOverview(range),
  ]);
}

/** Bump caches for search, venues, speakers, geo (event/venue/country data changed). */
export async function invalidateDiscoveryCaches(): Promise<void> {
  await Promise.all([
    bumpCacheVersion(CACHE_VERSION_KEYS.search),
    bumpCacheVersion(CACHE_VERSION_KEYS.geo),
    bumpCacheVersion(CACHE_VERSION_KEYS.venuesList),
    bumpCacheVersion(CACHE_VERSION_KEYS.speakersList),
  ]);
}

export async function invalidateOrganizerCaches(opts?: { id?: string; slug?: string }): Promise<void> {
  const profileKeys = [
    ...(opts?.id ? [CACHE_KEYS.organizerProfile(opts.id)] : []),
    ...(opts?.slug ? [CACHE_KEYS.organizerProfile(opts.slug)] : []),
  ];

  await Promise.all([
    bumpCacheVersion(CACHE_VERSION_KEYS.organizersList),
    bumpCacheVersion(CACHE_VERSION_KEYS.organizersFacets),
    bumpCacheVersion(CACHE_VERSION_KEYS.organizerEvents),
    bumpCacheVersion(CACHE_VERSION_KEYS.adminOrganizersList),
    ...(profileKeys.length > 0 ? [cacheDel(...profileKeys)] : []),
  ]);
}

export async function invalidateAdminOrganizerCaches(): Promise<void> {
  await bumpCacheVersion(CACHE_VERSION_KEYS.adminOrganizersList);
}

export async function invalidateVenueCaches(): Promise<void> {
  await bumpCacheVersion(CACHE_VERSION_KEYS.venuesList);
}

export async function invalidateSpeakerCaches(): Promise<void> {
  await bumpCacheVersion(CACHE_VERSION_KEYS.speakersList);
}

export async function invalidateExhibitorCaches(opts?: { id?: string; slug?: string }): Promise<void> {
  const keys = [
    ...(opts?.id ? [CACHE_KEYS.exhibitorProfile(opts.id)] : []),
    ...(opts?.slug ? [CACHE_KEYS.exhibitorProfile(opts.slug)] : []),
  ];
  if (keys.length > 0) await cacheDel(...keys);
}

export async function invalidateBannerCaches(): Promise<void> {
  await bumpCacheVersion(CACHE_VERSION_KEYS.banners);
}

export async function invalidateGeoCaches(): Promise<void> {
  await bumpCacheVersion(CACHE_VERSION_KEYS.geo);
}

export async function invalidatePromotionPackageCaches(): Promise<void> {
  await cacheDel(CACHE_KEYS.promotionPackages());
}

export async function invalidateEventCaches(opts?: { slug?: string; id?: string }): Promise<void> {
  const detailKeys = [
    ...(opts?.slug ? [CACHE_KEYS.eventDetail(normalizeDetailKey(opts.slug))] : []),
    ...(opts?.id ? [CACHE_KEYS.eventDetail(normalizeDetailKey(opts.id))] : []),
  ];

  const keysToDelete = [
    CACHE_KEYS.adminEventsStats(),
    CACHE_KEYS.eventsCategoriesBrowse(),
    CACHE_KEYS.eventsVip(),
    CACHE_KEYS.eventsFeatured(),
    ...detailKeys,
    ...adminDashboardKeysToDelete(),
  ];

  await Promise.all([
    bumpCacheVersion(CACHE_VERSION_KEYS.eventsList),
    bumpCacheVersion(CACHE_VERSION_KEYS.eventsStats),
    bumpCacheVersion(CACHE_VERSION_KEYS.organizersList),
    bumpCacheVersion(CACHE_VERSION_KEYS.organizersFacets),
    bumpCacheVersion(CACHE_VERSION_KEYS.organizerEvents),
    bumpCacheVersion(CACHE_VERSION_KEYS.adminEventsList),
    cacheDel(...keysToDelete),
    invalidateDiscoveryCaches(),
  ]);
}

export const CACHE_TTL = {
  EVENTS_LIST: 60,
  EVENTS_VIP: 120,
  EVENTS_FEATURED: 120,
  EVENT_DETAIL: 120,
  ORGANIZERS_LIST: 120,
  ORGANIZER_PROFILE: 120,
  ORGANIZER_EVENTS: 60,
  ORGANIZERS_FACETS: 300,
  ADMIN_EVENTS_STATS: 120,
  ADMIN_EVENTS_LIST: 30,
  ADMIN_DASHBOARD: 60,
  ADMIN_EVENT_OVERVIEW: 60,
  ADMIN_ORGANIZERS_LIST: 60,
  EVENTS_STATS: 300,
  EVENTS_CATEGORIES_BROWSE: 300,
  VENUES_LIST: 120,
  SPEAKERS_LIST: 120,
  EXHIBITOR_PROFILE: 120,
  SEARCH: 30,
  BANNERS: 300,
  GEO: 3600,
  PROMOTION_PACKAGES: 300,
} as const;

export const CACHE_KEYS = {
  adminEventsStats: () => "admin:events:stats",
  eventsCategoriesBrowse: () => "events:categories:browse",
  eventsVip: () => "events:vip",
  eventsFeatured: () => "events:featured",
  eventDetail: (identifier: string) => `event:detail:${normalizeDetailKey(identifier)}`,
  organizerProfile: (identifier: string) => `organizer:profile:${normalizeDetailKey(identifier)}`,
  exhibitorProfile: (identifier: string) => `exhibitor:profile:${normalizeDetailKey(identifier)}`,
  adminDashboard: (range: string) => `admin:dashboard:${range}`,
  adminEventOverview: (range: string) => `admin:dashboard:event-overview:${range}`,
  promotionPackages: () => "promotion:packages:all",
} as const;
