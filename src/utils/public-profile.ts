import type { Prisma } from "@prisma/client";

/**
 * Users whose profile may appear on the public marketing site.
 * Private profiles are hidden from listings, search, and public profile APIs
 * (unless the viewer is the same user — handled in handlers/services).
 */
export function activePublicProfileUserWhere(): Prisma.UserWhereInput {
  return {
    isActive: true,
    NOT: { profileVisibility: "private" },
  };
}

/**
 * Published events visible on the public site: organizer (and venue, if any)
 * must have a public, active profile.
 */
export function publicPublishedEventWhere(): Prisma.EventWhereInput {
  return {
    status: "PUBLISHED",
    isPublic: true,
    organizer: activePublicProfileUserWhere(),
    OR: [
      { venueId: null },
      {
        /** Listed on /venues uses isVerified; venue login is not tied to isActive. */
        venue: {
          NOT: { profileVisibility: "private" },
          isVerified: true,
        },
      },
    ],
  };
}

export function canUserViewOwnPrivateProfile(viewerUserId: string | undefined, profileUserId: string): boolean {
  if (!viewerUserId) return false;
  const a = viewerUserId.trim().toLowerCase();
  const b = profileUserId.trim().toLowerCase();
  return a.length > 0 && a === b;
}

export function canBypassEventPrivacy(
  viewerUserId: string | undefined,
  event: { organizerId: string; venueId: string | null }
): boolean {
  if (!viewerUserId) return false;
  if (viewerUserId === event.organizerId) return true;
  if (event.venueId && viewerUserId === event.venueId) return true;
  return false;
}

/** After loading an event with organizer + venue, determine if it may be shown publicly. */
export function isEventPubliclyVisible(event: {
  organizerId: string;
  venueId: string | null;
  organizer: { isActive?: boolean; profileVisibility?: string } | null;
  venue: { isActive?: boolean; profileVisibility?: string } | null;
}): boolean {
  const o = event.organizer;
  if (!o || !o.isActive || o.profileVisibility === "private") return false;
  if (event.venueId) {
    const v = event.venue;
    if (!v || v.profileVisibility === "private") return false;
    if ("isVerified" in v && v.isVerified === false) return false;
  }
  return true;
}
