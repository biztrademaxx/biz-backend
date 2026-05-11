"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activePublicProfileUserWhere = activePublicProfileUserWhere;
exports.publicPublishedEventWhere = publicPublishedEventWhere;
exports.canUserViewOwnPrivateProfile = canUserViewOwnPrivateProfile;
exports.canBypassEventPrivacy = canBypassEventPrivacy;
exports.isEventPubliclyVisible = isEventPubliclyVisible;
/**
 * Users whose profile may appear on the public marketing site.
 * Private profiles are hidden from listings, search, and public profile APIs
 * (unless the viewer is the same user — handled in handlers/services).
 */
function activePublicProfileUserWhere() {
    return {
        isActive: true,
        NOT: { profileVisibility: "private" },
    };
}
/**
 * Published events visible on the public site: organizer (and venue, if any)
 * must have a public, active profile.
 */
function publicPublishedEventWhere() {
    return {
        status: "PUBLISHED",
        isPublic: true,
        organizer: activePublicProfileUserWhere(),
        OR: [{ venueId: null }, { venue: activePublicProfileUserWhere() }],
    };
}
function canUserViewOwnPrivateProfile(viewerUserId, profileUserId) {
    if (!viewerUserId)
        return false;
    const a = viewerUserId.trim().toLowerCase();
    const b = profileUserId.trim().toLowerCase();
    return a.length > 0 && a === b;
}
function canBypassEventPrivacy(viewerUserId, event) {
    if (!viewerUserId)
        return false;
    if (viewerUserId === event.organizerId)
        return true;
    if (event.venueId && viewerUserId === event.venueId)
        return true;
    return false;
}
/** After loading an event with organizer + venue, determine if it may be shown publicly. */
function isEventPubliclyVisible(event) {
    const o = event.organizer;
    if (!o || !o.isActive || o.profileVisibility === "private")
        return false;
    if (event.venueId) {
        const v = event.venue;
        if (!v || !v.isActive || v.profileVisibility === "private")
            return false;
    }
    return true;
}
