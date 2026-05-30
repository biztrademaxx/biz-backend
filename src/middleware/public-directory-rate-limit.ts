import rateLimit from "express-rate-limit";

/** Paginated directory browsing — slows bulk scraping while allowing normal use. */
export const publicOrganizersListLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

/** Facets expose filter values for the whole directory — keep this stricter. */
export const publicOrganizersFacetsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 24,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
