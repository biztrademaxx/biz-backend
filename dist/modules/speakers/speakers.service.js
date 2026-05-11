"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSpeakers = listSpeakers;
exports.getSpeakerById = getSpeakerById;
exports.getSpeakerSessions = getSpeakerSessions;
exports.createSpeaker = createSpeaker;
exports.updateSpeakerProfile = updateSpeakerProfile;
exports.getSpeakerEvents = getSpeakerEvents;
const prisma_1 = __importDefault(require("../../config/prisma"));
const public_profile_1 = require("../../utils/public-profile");
const profile_image_1 = require("../../utils/profile-image");
const display_name_1 = require("../../utils/display-name");
const profile_slug_1 = require("../../utils/profile-slug");
// List speakers
async function listSpeakers(options) {
    const requireProfileImage = options?.requireProfileImage ?? false;
    await prisma_1.default.$connect();
    const speakers = await prisma_1.default.user.findMany({
        where: {
            role: "SPEAKER",
            ...(0, public_profile_1.activePublicProfileUserWhere)(),
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            bio: true,
            company: true,
            jobTitle: true,
            location: true,
            website: true,
            linkedin: true,
            twitter: true,
            specialties: true,
            achievements: true,
            certifications: true,
            speakingExperience: true,
            isVerified: true,
            totalEvents: true,
            activeEvents: true,
            totalAttendees: true,
            totalRevenue: true,
            averageRating: true,
            totalReviews: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    const filtered = requireProfileImage
        ? speakers.filter((s) => (0, profile_image_1.hasPublicProfileImage)(s.avatar))
        : speakers;
    return filtered.map((s) => ({
        ...s,
        publicSlug: (0, profile_slug_1.getPublicProfileSlug)({
            role: "SPEAKER",
            firstName: s.firstName,
            lastName: s.lastName,
        }, "SPEAKER"),
        specialties: Array.isArray(s.specialties) ? s.specialties : [],
        achievements: Array.isArray(s.achievements) ? s.achievements : [],
        certifications: Array.isArray(s.certifications) ? s.certifications : [],
    }));
}
// Single speaker profile
async function resolveSpeakerId(identifier) {
    if ((0, profile_slug_1.isUuidLike)(identifier))
        return identifier;
    const targetSlug = String(identifier || "").trim().toLowerCase();
    if (!targetSlug)
        return null;
    const speakers = await prisma_1.default.user.findMany({
        where: { role: "SPEAKER", isActive: true },
        select: { id: true, firstName: true, lastName: true },
    });
    const withSlug = speakers.map((u) => ({
        u,
        slug: (0, profile_slug_1.getPublicProfileSlug)({ role: "SPEAKER", firstName: u.firstName, lastName: u.lastName }, "SPEAKER"),
    }));
    const exact = withSlug.filter((x) => x.slug === targetSlug);
    if (exact.length === 1)
        return exact[0].u.id;
    const loose = withSlug.filter((x) => (0, profile_slug_1.publicSlugRequestMatches)(x.slug, targetSlug));
    if (loose.length === 1)
        return loose[0].u.id;
    if (loose.length > 1) {
        const narrowed = loose.filter((x) => x.slug === targetSlug);
        if (narrowed.length === 1)
            return narrowed[0].u.id;
        return null;
    }
    return null;
}
async function getSpeakerById(identifier, viewerUserId) {
    const id = await resolveSpeakerId(identifier);
    if (!id)
        return null;
    await prisma_1.default.$connect();
    const isSelf = (0, public_profile_1.canUserViewOwnPrivateProfile)(viewerUserId ?? undefined, id);
    const speaker = await prisma_1.default.user.findFirst({
        where: {
            id,
            role: "SPEAKER",
            ...(isSelf ? {} : (0, public_profile_1.activePublicProfileUserWhere)()),
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            role: true,
            bio: true,
            company: true,
            jobTitle: true,
            location: true,
            website: true,
            linkedin: true,
            twitter: true,
            specialties: true,
            achievements: true,
            certifications: true,
            speakingExperience: true,
            isVerified: true,
            totalEvents: true,
            activeEvents: true,
            totalAttendees: true,
            totalRevenue: true,
            averageRating: true,
            totalReviews: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!speaker) {
        return null;
    }
    const displayName = (0, display_name_1.getDisplayName)(speaker);
    const profile = {
        displayName,
        publicSlug: (0, profile_slug_1.getPublicProfileSlug)({
            role: "SPEAKER",
            firstName: speaker.firstName,
            lastName: speaker.lastName,
        }, "SPEAKER"),
        fullName: displayName,
        designation: speaker.jobTitle || "",
        company: speaker.company || "",
        email: speaker.email,
        phone: speaker.phone || "",
        linkedin: speaker.linkedin || "",
        website: speaker.website || "",
        location: speaker.location || "",
        bio: speaker.bio || "",
        speakingExperience: speaker.speakingExperience || "",
        avatar: speaker.avatar || undefined,
    };
    return profile;
}
// Speaker sessions (for Presentation Materials / My Sessions)
async function getSpeakerSessions(speakerId) {
    speakerId = (await resolveSpeakerId(speakerId)) ?? "";
    if (!speakerId)
        return [];
    const sessions = await prisma_1.default.speakerSession.findMany({
        where: { speakerId },
        include: {
            event: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    startDate: true,
                    endDate: true,
                },
            },
            materials: {
                orderBy: { uploadedAt: "desc" },
            },
        },
        orderBy: { startTime: "desc" },
    });
    return sessions.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        sessionType: s.sessionType,
        duration: s.duration,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        room: s.room ?? null,
        status: s.status,
        youtube: s.youtube ?? [],
        event: s.event
            ? {
                id: s.event.id,
                name: s.event.title,
                title: s.event.title,
                slug: s.event.slug,
                startDate: s.event.startDate.toISOString(),
                endDate: s.event.endDate.toISOString(),
            }
            : null,
        materials: (s.materials ?? []).map((m) => ({
            id: m.id,
            fileName: m.fileName,
            fileUrl: m.fileUrl,
            fileSize: m.fileSize,
            fileType: m.fileType,
            mimeType: m.mimeType,
            status: m.status,
            allowDownload: m.allowDownload,
            uploadedAt: m.uploadedAt.toISOString(),
            downloadCount: m.downloadCount,
            viewCount: m.viewCount,
        })),
        deadline: s.endTime.toISOString(),
    }));
}
// Create a new speaker (event dashboard "Create new speaker")
async function createSpeaker(body) {
    const { firstName, lastName, email, phone, bio, company, jobTitle, location, website, linkedin, twitter, specialties, achievements, certifications, speakingExperience, avatar, } = body;
    if (!firstName || !lastName || !email) {
        throw new Error("First name, last name, and email are required");
    }
    const existing = await prisma_1.default.user.findFirst({
        where: { email: email.trim(), role: "SPEAKER" },
        select: { id: true },
    });
    if (existing) {
        throw new Error("Speaker with this email already exists");
    }
    const speaker = await prisma_1.default.user.create({
        data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone?.trim() ?? null,
            bio: bio?.trim() ?? null,
            company: company?.trim() ?? null,
            jobTitle: jobTitle?.trim() ?? null,
            location: location?.trim() ?? null,
            website: website?.trim() ?? null,
            linkedin: linkedin?.trim() ?? null,
            twitter: twitter?.trim() ?? null,
            specialties: Array.isArray(specialties) ? specialties : [],
            achievements: Array.isArray(achievements) ? achievements : [],
            certifications: Array.isArray(certifications) ? certifications : [],
            speakingExperience: speakingExperience?.trim() ?? null,
            avatar: avatar?.trim() ?? null,
            role: "SPEAKER",
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            bio: true,
            company: true,
            jobTitle: true,
            location: true,
            website: true,
            linkedin: true,
            twitter: true,
            specialties: true,
            achievements: true,
            certifications: true,
            speakingExperience: true,
        },
    });
    return speaker;
}
// Update speaker profile (dashboard save)
async function updateSpeakerProfile(id, body) {
    const existing = await prisma_1.default.user.findUnique({
        where: { id, role: "SPEAKER" },
        select: { id: true },
    });
    if (!existing) {
        return null;
    }
    const fullNameTrimmed = (body.fullName ?? "").trim();
    const data = {};
    if (fullNameTrimmed) {
        const [firstName, ...lastNameParts] = fullNameTrimmed.split(" ");
        data.firstName = firstName ?? undefined;
        data.lastName = lastNameParts.join(" ").trim() || undefined;
    }
    if (body.designation !== undefined)
        data.jobTitle = body.designation;
    if (body.company !== undefined)
        data.company = body.company;
    if (body.email !== undefined)
        data.email = body.email;
    if (body.phone !== undefined)
        data.phone = body.phone;
    if (body.linkedin !== undefined)
        data.linkedin = body.linkedin;
    if (body.website !== undefined)
        data.website = body.website;
    if (body.location !== undefined)
        data.location = body.location;
    if (body.bio !== undefined)
        data.bio = body.bio;
    if (body.speakingExperience !== undefined)
        data.speakingExperience = body.speakingExperience;
    if (body.avatar !== undefined)
        data.avatar = body.avatar;
    if (Object.keys(data).length === 0) {
        return getSpeakerById(id, id);
    }
    const updated = await prisma_1.default.user.update({
        where: { id },
        data,
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            bio: true,
            company: true,
            jobTitle: true,
            location: true,
            website: true,
            linkedin: true,
            speakingExperience: true,
        },
    });
    return {
        fullName: `${updated.firstName} ${updated.lastName}`.trim(),
        designation: updated.jobTitle || "",
        company: updated.company || "",
        email: updated.email,
        phone: updated.phone || "",
        linkedin: updated.linkedin || "",
        website: updated.website || "",
        location: updated.location || "",
        bio: updated.bio || "",
        speakingExperience: updated.speakingExperience || "",
        avatar: updated.avatar || undefined,
    };
}
// Speaker events
async function getSpeakerEvents(id, viewerUserId) {
    const speakerId = (await resolveSpeakerId(id)) ?? "";
    if (!speakerId)
        return { success: true, upcoming: [], past: [] };
    await prisma_1.default.$connect();
    const isSelf = (0, public_profile_1.canUserViewOwnPrivateProfile)(viewerUserId ?? undefined, speakerId);
    if (!isSelf) {
        const visible = await prisma_1.default.user.findFirst({
            where: { id: speakerId, role: "SPEAKER", ...(0, public_profile_1.activePublicProfileUserWhere)() },
            select: { id: true },
        });
        if (!visible) {
            return { success: true, upcoming: [], past: [] };
        }
    }
    const sessionWhere = { speakerId };
    if (!isSelf) {
        sessionWhere.event = { is: (0, public_profile_1.publicPublishedEventWhere)() };
    }
    const sessions = await prisma_1.default.speakerSession.findMany({
        where: sessionWhere,
        include: {
            event: {
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    startDate: true,
                    bannerImage: true,
                    averageRating: true,
                    currentAttendees: true,
                    venue: true,
                },
            },
        },
        orderBy: { startTime: "desc" },
    });
    const now = new Date();
    const upcoming = sessions.filter((s) => new Date(s.startTime) > now);
    const past = sessions.filter((s) => new Date(s.startTime) <= now);
    const mapSessionToEvent = (session) => ({
        id: session.event.id,
        slug: session.event.slug ?? "",
        title: session.event.title,
        date: session.event.startDate.toISOString(),
        location: session.event.venue
            ? `${session.event.venue.venueName ?? ""}, ${session.event.venue.venueCity ?? ""}, ${session.event.venue.venueState ?? ""}, ${session.event.venue.venueCountry ?? ""}`.replace(/^,\s*|,\s*$/g, "").replace(/,\s*,/g, ",") || "TBD"
            : "TBD",
        image: session.event.bannerImage || "/images/gpex.jpg",
        averageRating: session.event.averageRating || 0,
        currentAttendees: session.event.currentAttendees || 0,
    });
    const dedupeByEventId = (sessionsList) => {
        const seen = new Set();
        const out = [];
        for (const s of sessionsList) {
            const eid = s.event?.id;
            if (!eid || seen.has(eid))
                continue;
            seen.add(eid);
            out.push(mapSessionToEvent(s));
        }
        return out;
    };
    return {
        success: true,
        upcoming: dedupeByEventId(upcoming),
        past: dedupeByEventId(past),
    };
}
