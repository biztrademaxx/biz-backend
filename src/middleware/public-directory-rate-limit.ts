import type { Request } from "express";
import rateLimit from "express-rate-limit";
import {
  organizersFacetsCacheKey,
  organizersListCacheKey,
  redis,
} from "../config/redis";
import { organizersListOptionsFromRequest } from "./organizers-list-query";

function isCrawlerUserAgent(req: Request): boolean {
  const ua = req.headers["user-agent"] || "";
  return /Googlebot|Bingbot|Slackbot|LinkedInBot/i.test(String(ua));
}

async function hasOrganizersListCache(req: Request): Promise<boolean> {
  if (!redis) return false;
  try {
    const key = await organizersListCacheKey(
      organizersListOptionsFromRequest(req) as Record<string, unknown>,
    );
    const hit = await redis.get(key);
    return hit !== null && hit !== undefined;
  } catch {
    return false;
  }
}

async function hasOrganizersFacetsCache(): Promise<boolean> {
  if (!redis) return false;
  try {
    const key = await organizersFacetsCacheKey();
    const hit = await redis.get(key);
    return hit !== null && hit !== undefined;
  } catch {
    return false;
  }
}

/**
 * Public organizers listing
 * Allows normal browsing, pagination, search and retries
 */
export const publicOrganizersListLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: "Too many requests. Please try again later.",
  },

  skip: async (req) => {
    if (isCrawlerUserAgent(req)) return true;
    return hasOrganizersListCache(req);
  },
});

/**
 * Public organizers facets
 * (countries, cities, industries, filters)
 */
export const publicOrganizersFacetsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: "Too many requests. Please try again later.",
  },

  skip: async (req) => {
    if (isCrawlerUserAgent(req)) return true;
    return hasOrganizersFacetsCache();
  },
});
