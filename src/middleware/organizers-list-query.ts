import type { Request } from "express";
import type { ListOrganizersOptions } from "../modules/organizers/organizers.service";

/** Parse public GET /organizers query — shared by handler and cache-aware rate limit. */
export function organizersListOptionsFromRequest(req: Request): ListOrganizersOptions {
  const requireProfileImage =
    req.query.requireProfileImage === "1" || req.query.requireProfileImage === "true";
  const paginate = req.query.page != null || req.query.limit != null;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const country = typeof req.query.country === "string" ? req.query.country : undefined;
  const city = typeof req.query.city === "string" ? req.query.city : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const eventsBucket =
    typeof req.query.eventsBucket === "string" ? req.query.eventsBucket : undefined;
  const followersBucket =
    typeof req.query.followersBucket === "string" ? req.query.followersBucket : undefined;
  const prioritizeCountry =
    typeof req.query.prioritizeCountry === "string" ? req.query.prioritizeCountry : undefined;
  const prioritizeCountryCode =
    typeof req.query.prioritizeCountryCode === "string"
      ? req.query.prioritizeCountryCode
      : undefined;
  const prioritizeCity =
    typeof req.query.prioritizeCity === "string" ? req.query.prioritizeCity : undefined;

  return {
    requireProfileImage,
    paginate,
    page,
    limit,
    search,
    country,
    city,
    category,
    eventsBucket,
    followersBucket,
    prioritizeCountry,
    prioritizeCountryCode,
    prioritizeCity,
  };
}
