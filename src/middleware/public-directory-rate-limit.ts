import rateLimit from "express-rate-limit";

/**
 * Public organizers listing
 * Allows normal browsing, pagination, search and retries
 */
export const publicOrganizersListLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: "Too many requests. Please try again later.",
  },

  skip: (req) => {
    const ua = req.headers["user-agent"] || "";
    return /Googlebot|Bingbot|Slackbot|LinkedInBot/i.test(String(ua));
  },
});

/**
 * Public organizers facets
 * (countries, cities, industries, filterss)
 */
export const publicOrganizersFacetsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: "Too many requests. Please try again later.",
  },

  skip: (req) => {
    const ua = req.headers["user-agent"] || "";
    return /Googlebot|Bingbot|Slackbot|LinkedInBot/i.test(String(ua));
  },
});
