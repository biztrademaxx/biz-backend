"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const public_profile_1 = require("../utils/public-profile");
const display_name_1 = require("../utils/display-name");
const profile_slug_1 = require("../utils/profile-slug");
const router = (0, express_1.Router)();
function serializeUser(user) {
    return {
        ...user,
        companyIndustry: user.companyIndustry ?? null,
        interests: user.interests ?? [],
        createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
        updatedAt: user.updatedAt?.toISOString?.() ?? user.updatedAt,
        lastLogin: user.lastLogin?.toISOString?.() ?? user.lastLogin ?? null,
        displayName: (0, display_name_1.getDisplayName)(user),
        publicSlug: (0, profile_slug_1.getPublicProfileSlug)(user, "ATTENDEE"),
        _count: { eventsAttended: 0, eventsOrganized: 0, connections: 0 },
    };
}
async function resolveUserId(identifier) {
    if ((0, profile_slug_1.isUuidLike)(identifier))
        return identifier;
    const targetSlug = String(identifier || "").trim().toLowerCase();
    if (!targetSlug)
        return null;
    const users = await prisma_1.default.user.findMany({
        where: { role: "ATTENDEE", isActive: true },
        select: { id: true, firstName: true, lastName: true },
        take: 5000,
    });
    const withSlug = users.map((u) => ({
        u,
        slug: (0, profile_slug_1.getPublicProfileSlug)({ role: "ATTENDEE", firstName: u.firstName, lastName: u.lastName }, "ATTENDEE"),
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
/** Map Prisma event (with venue, ticketTypes) to frontend dashboard shape. */
function toFrontendEvent(event) {
    const venue = event?.venue;
    return {
        id: event.id,
        title: event.title,
        description: event.description,
        shortDescription: event.shortDescription ?? "",
        startDate: event.startDate instanceof Date ? event.startDate.toISOString() : event.startDate,
        endDate: event.endDate instanceof Date ? event.endDate.toISOString() : event.endDate,
        location: venue?.venueName ?? null,
        city: venue?.venueCity ?? null,
        state: venue?.venueState ?? null,
        address: venue?.venueAddress ?? null,
        category: Array.isArray(event.category) ? event.category[0] : "Event",
        categories: event.category ?? [],
        status: event.status,
        type: Array.isArray(event.eventType) ? event.eventType[0] : "General",
        eventTypes: event.eventType ?? [],
        bannerImage: event.bannerImage ?? "",
        thumbnailImage: event.thumbnailImage ?? "",
        maxAttendees: event.maxAttendees ?? 0,
        organizer: event.organizer ?? null,
        venue: venue ?? null,
        ticketTypes: event.ticketTypes ?? [],
    };
}
/**
 * GET /api/users/search?q=...
 * User search for "Find people" / connections. Must be before /users/:id so "search" is not captured as id.
 */
router.get("/users/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
        return res.json({ success: true, data: [], users: [] });
    }
    try {
        const users = await prisma_1.default.user.findMany({
            where: {
                ...(0, public_profile_1.activePublicProfileUserWhere)(),
                OR: [
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { company: { contains: q, mode: "insensitive" } },
                    { jobTitle: { contains: q, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                company: true,
                jobTitle: true,
            },
            take: 50,
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });
        return res.json({
            success: true,
            data: users,
            users,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error searching users:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/users/:id
 * Public user profile by id (used by dashboards).
 * Private profiles return 404 unless the viewer is the same user (send Bearer token).
 */
router.get("/users/:id", auth_middleware_1.optionalUser, async (req, res) => {
    const { id: identifier } = req.params;
    const id = await resolveUserId(identifier);
    if (!id) {
        if (!(0, profile_slug_1.isUuidLike)(identifier)) {
            return res
                .status(404)
                .json({ success: false, error: "User not found" });
        }
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    try {
        const viewerId = req.auth?.domain === "USER" ? req.auth.sub : undefined;
        const user = await prisma_1.default.user.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                bio: true,
                website: true,
                linkedin: true,
                twitter: true,
                instagram: true,
                company: true,
                organizationName: true,
                companyIndustry: true,
                jobTitle: true,
                location: true,
                interests: true,
                isVerified: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                isActive: true,
                profileVisibility: true,
            },
        });
        if (!user) {
            return res
                .status(404)
                .json({ success: false, error: "User not found" });
        }
        if (!(0, public_profile_1.canUserViewOwnPrivateProfile)(viewerId, id) &&
            (!user.isActive || user.profileVisibility === "private")) {
            return res
                .status(404)
                .json({ success: false, error: "User not found" });
        }
        const { isActive: _ia, profileVisibility: _pv, ...publicUser } = user;
        const userData = serializeUser(publicUser);
        // Keep legacy { user } shape for frontend compatibility, but also expose
        // { success, data } for new consumers.
        return res.json({
            success: true,
            data: userData,
            user: userData,
        });
    }
    catch (err) {
        console.error("Error fetching user by id:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * PUT /api/users/:id
 * Update basic user profile fields (self-service).
 * Protected by JWT via requireUser; only the user themself can update.
 */
router.put("/users/:id", auth_middleware_1.requireUser, async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    const auth = req.auth;
    if (!auth || auth.sub !== id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
    }
    const { email, firstName, lastName, avatar, phone, bio, website, company, companyIndustry, jobTitle, linkedin, twitter, instagram, interests, } = req.body ?? {};
    const data = {};
    if (email !== undefined)
        data.email = email;
    if (firstName !== undefined)
        data.firstName = firstName;
    if (lastName !== undefined)
        data.lastName = lastName;
    if (avatar !== undefined)
        data.avatar = avatar;
    if (phone !== undefined)
        data.phone = phone;
    if (bio !== undefined)
        data.bio = bio;
    if (website !== undefined)
        data.website = website;
    if (company !== undefined)
        data.company = company;
    if (companyIndustry !== undefined)
        data.companyIndustry = companyIndustry;
    if (jobTitle !== undefined)
        data.jobTitle = jobTitle;
    if (linkedin !== undefined)
        data.linkedin = linkedin;
    if (twitter !== undefined)
        data.twitter = twitter;
    if (instagram !== undefined)
        data.instagram = instagram;
    if (interests !== undefined) {
        data.interests = Array.isArray(interests) ? interests : [];
    }
    if (Object.keys(data).length === 0) {
        return res
            .status(400)
            .json({ success: false, error: "No fields to update" });
    }
    try {
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
                role: true,
                bio: true,
                website: true,
                linkedin: true,
                twitter: true,
                instagram: true,
                company: true,
                organizationName: true,
                companyIndustry: true,
                jobTitle: true,
                location: true,
                interests: true,
                isVerified: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        const userData = serializeUser(updated);
        return res.json({
            success: true,
            data: userData,
            user: userData,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error updating user profile:", err);
        if (err.code === "P2025") {
            return res
                .status(404)
                .json({ success: false, error: "User not found" });
        }
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/users/:id/connections
 * Lightweight "connections" list used by dashboards (messaging sidebar, etc.).
 * Currently returns a curated list of active users (excluding self).
 */
router.get("/users/:id/connections", async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    try {
        // Verify user exists
        const user = await prisma_1.default.user.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!user) {
            return res
                .status(404)
                .json({ success: false, error: "User not found" });
        }
        const others = await prisma_1.default.user.findMany({
            where: {
                AND: [{ id: { not: id } }, { isActive: true }],
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                role: true,
                company: true,
                jobTitle: true,
                lastLogin: true,
            },
            orderBy: [
                { lastLogin: "desc" },
                { firstName: "asc" },
            ],
            take: 100,
        });
        const connections = others.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            avatar: u.avatar || "/placeholder.svg?height=40&width=40",
            role: u.role,
            company: u.company || "No Company",
            jobTitle: u.jobTitle || "No Title",
            lastLogin: u.lastLogin?.toISOString() ?? new Date().toISOString(),
            isOnline: false,
        }));
        return res.json({
            success: true,
            data: connections,
            connections,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching user connections:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/users/:id/interested-events
 * Used by calendar, past-events, and events-section to show a user's saved (interested) events.
 */
router.get("/users/:id/interested-events", async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    try {
        const saved = await prisma_1.default.savedEvent.findMany({
            where: { userId: id },
            include: {
                event: {
                    include: {
                        ticketTypes: true,
                        venue: true,
                        organizer: true,
                    },
                },
            },
            orderBy: { savedAt: "desc" },
        });
        const rawEvents = saved
            .map((s) => s.event)
            .filter((e) => Boolean(e));
        const events = rawEvents.map((e) => toFrontendEvent(e));
        return res.json({
            success: true,
            data: events,
            events,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching interested events:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/users/:id/saved-events
 * Saved events (wishlist) timeline in visitor dashboard. JWT required; user can only fetch own list.
 */
router.get("/users/:id/saved-events", auth_middleware_1.requireUser, async (req, res) => {
    const { id } = req.params;
    const auth = req.auth;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    if (!auth || auth.sub !== id) {
        return res
            .status(403)
            .json({ success: false, error: "You can only view your own saved events" });
    }
    try {
        const saved = await prisma_1.default.savedEvent.findMany({
            where: { userId: id },
            include: {
                event: {
                    include: {
                        ticketTypes: true,
                        venue: true,
                        organizer: true,
                    },
                },
            },
            orderBy: { savedAt: "desc" },
        });
        const rawEvents = saved
            .map((s) => s.event)
            .filter((e) => Boolean(e));
        const events = rawEvents.map((e) => toFrontendEvent(e));
        return res.json({
            success: true,
            data: events,
            events,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching saved events:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/users/:id/events
 * Generic events list for a user – for now this mirrors "interested events".
 */
router.get("/users/:id/events", async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    try {
        const registrations = await prisma_1.default.eventRegistration.findMany({
            where: { userId: id },
            include: {
                event: {
                    include: {
                        ticketTypes: true,
                    },
                },
            },
            orderBy: { registeredAt: "desc" },
        });
        const events = registrations
            .map((r) => r.event)
            .filter((e) => Boolean(e));
        return res.json({
            success: true,
            data: events,
            events,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching user events:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/users/:id/appointments
 * Visitor "My Appointments" – currently stubbed until Appointment model exists.
 */
router.get("/users/:id/appointments", async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    try {
        // TODO: implement real visitor appointments once Appointment model exists.
        const appointments = [];
        return res.json({
            success: true,
            data: appointments,
            appointments,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching user appointments:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/users/:id/messages
 * Basic stub so visitor messaging UI does not crash.
 */
router.get("/users/:id/messages", async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    try {
        // TODO: back this with a Message model/conversation system.
        const messages = [];
        return res.json({
            success: true,
            data: messages,
            messages,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching user messages:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * POST /api/users/:id/messages
 * Stub create endpoint – echoes the payload for now.
 */
router.post("/users/:id/messages", async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res
            .status(400)
            .json({ success: false, error: "User id required" });
    }
    try {
        const body = req.body ?? {};
        const message = {
            id: "stub-message-id",
            userId: id,
            ...body,
            createdAt: new Date().toISOString(),
        };
        return res.status(201).json({
            success: true,
            data: message,
            message,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error creating user message:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/notifications
 * Global notifications feed for the current user – stubbed for now.
 */
router.get("/notifications", async (_req, res) => {
    try {
        const notifications = [];
        return res.json({
            success: true,
            data: notifications,
            notifications,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching notifications:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * GET /api/settings
 * Backend counterpart to user settings – returns safe defaults.
 */
router.get("/settings", async (req, res) => {
    try {
        const auth = req.auth;
        const userId = auth?.sub;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, error: "Unauthorized" });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                isVerified: true,
                emailVerified: true,
                phoneVerified: true,
            },
        });
        if (!user) {
            return res
                .status(404)
                .json({ success: false, error: "User not found" });
        }
        const settings = {
            profileVisibility: "public",
            phoneNumber: user.phone ?? "",
            email: user.email ?? "",
            introduceMe: true,
            emailNotifications: true,
            eventReminders: true,
            newMessages: true,
            connectionRequests: true,
            isVerified: user.isVerified,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            role: user.role,
        };
        return res.json({
            success: true,
            data: settings,
            settings,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching settings (backend):", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
/**
 * PATCH /api/settings
 * Stub update – echoes merged settings back to the client.
 */
router.patch("/settings", async (req, res) => {
    try {
        const auth = req.auth;
        const userId = auth?.sub;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, error: "Unauthorized" });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                isVerified: true,
                emailVerified: true,
                phoneVerified: true,
            },
        });
        if (!user) {
            return res
                .status(404)
                .json({ success: false, error: "User not found" });
        }
        const base = {
            profileVisibility: "public",
            phoneNumber: user.phone ?? "",
            email: user.email ?? "",
            introduceMe: true,
            emailNotifications: true,
            eventReminders: true,
            newMessages: true,
            connectionRequests: true,
            isVerified: user.isVerified,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            role: user.role,
        };
        const body = req.body ?? {};
        const merged = {
            ...base,
            ...body,
        };
        return res.json({
            success: true,
            data: merged,
            settings: merged,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error updating settings (backend):", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error" });
    }
});
router.get("/users/:id/suggestions", auth_middleware_1.requireUser, async (req, res) => {
    const { id } = req.params;
    const auth = req.auth;
    if (!id) {
        return res.status(400).json({ success: false, error: "User id required" });
    }
    // Ensure the user can only access their own suggestions
    if (!auth || auth.sub !== id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
    }
    try {
        const { type = "personalized", limit = "12", search = "" } = req.query;
        if (type === "trending") {
            // Get trending exhibitors
            const trending = await getTrendingExhibitors({
                limit: parseInt(limit, 10),
                search: search
            });
            return res.json({
                success: true,
                data: trending
            });
        }
        else {
            // Get personalized suggestions
            const visitorContext = await getVisitorContext(id);
            const suggestions = await getAvailableExhibitorsForSuggestion(id, {
                limit: parseInt(limit, 10),
                search: search
            });
            return res.json({
                success: true,
                data: {
                    suggestions,
                    visitorContext
                }
            });
        }
    }
    catch (error) {
        console.error("Error fetching suggestions:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch suggestions"
        });
    }
});
/**
 * POST /api/users/:id/connections - Send connection request to exhibitor
 */
router.post("/users/:id/connections", auth_middleware_1.requireUser, async (req, res) => {
    const { id } = req.params;
    const auth = req.auth;
    const { exhibitorId } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, error: "User id required" });
    }
    if (!auth || auth.sub !== id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
    }
    if (!exhibitorId) {
        return res.status(400).json({ success: false, error: "Exhibitor ID required" });
    }
    try {
        // Check if connection already exists
        const existing = await prisma_1.default.connection.findFirst({
            where: {
                OR: [
                    { requesterId: id, receiverId: exhibitorId },
                    { requesterId: exhibitorId, receiverId: id }
                ]
            }
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Connection request already exists"
            });
        }
        // Create connection request
        const connection = await prisma_1.default.connection.create({
            data: {
                requesterId: id,
                receiverId: exhibitorId,
                status: "PENDING"
            }
        });
        // Also update or create exhibitor suggestion record
        await prisma_1.default.exhibitorSuggestion.upsert({
            where: {
                visitorId_exhibitorId: {
                    visitorId: id,
                    exhibitorId: exhibitorId
                }
            },
            update: { status: "CONNECTED" },
            create: {
                visitorId: id,
                exhibitorId: exhibitorId,
                status: "CONNECTED",
                sentAt: new Date()
            }
        });
        return res.json({
            success: true,
            message: "Connection request sent successfully",
            data: connection
        });
    }
    catch (error) {
        console.error("Error creating connection:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to send connection request"
        });
    }
});
// Helper functions for suggestions
async function getVisitorContext(visitorId) {
    const visitor = await prisma_1.default.user.findUnique({
        where: { id: visitorId, role: "ATTENDEE" },
        select: {
            interests: true,
            companyIndustry: true,
            registrations: {
                where: { status: "CONFIRMED" },
                include: {
                    event: { select: { id: true, category: true } }
                }
            },
            savedEvents: {
                include: {
                    event: { select: { id: true, category: true } }
                }
            },
            exhibitorSuggestions: {
                where: { status: "PENDING" },
                select: { exhibitorId: true }
            }
        }
    });
    if (!visitor)
        return null;
    // Count unique exhibitors interacted with
    const interactedExhibitors = await prisma_1.default.appointment.count({
        where: { requesterId: visitorId }
    });
    // Extract categories from visitor's events and interests
    const categories = new Set();
    visitor.registrations?.forEach((registration) => {
        if (registration.event?.category && Array.isArray(registration.event.category)) {
            registration.event.category.forEach((cat) => categories.add(cat));
        }
    });
    visitor.savedEvents?.forEach((savedEvent) => {
        if (savedEvent.event?.category && Array.isArray(savedEvent.event.category)) {
            savedEvent.event.category.forEach((cat) => categories.add(cat));
        }
    });
    visitor.interests?.forEach((interest) => categories.add(interest));
    return {
        interests: visitor.interests || [],
        industry: visitor.companyIndustry,
        interactedExhibitorsCount: interactedExhibitors,
        categories: Array.from(categories),
        alreadySuggestedIds: visitor.exhibitorSuggestions?.map((s) => s.exhibitorId) || []
    };
}
async function getAvailableExhibitorsForSuggestion(visitorId, filters) {
    try {
        const { limit = 20, search } = filters;
        const visitor = await getVisitorContext(visitorId);
        if (!visitor)
            return [];
        // Build where clause for exhibitors
        const where = {
            role: "EXHIBITOR",
            isActive: true,
        };
        // Exclude already suggested exhibitors
        if (visitor.alreadySuggestedIds.length > 0) {
            where.id = { notIn: visitor.alreadySuggestedIds };
        }
        // Filter by visitor's categories
        if (visitor.categories.length > 0) {
            where.exhibitorBooths = {
                some: {
                    event: {
                        category: { hasSome: visitor.categories }
                    }
                }
            };
        }
        // Apply search filter
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }
        // Fetch exhibitors
        const exhibitors = await prisma_1.default.user.findMany({
            where,
            take: limit,
            orderBy: [{ createdAt: "desc" }],
            include: {
                exhibitorBooths: {
                    where: {
                        event: {
                            status: "PUBLISHED",
                            startDate: { gte: new Date() }
                        }
                    },
                    include: {
                        event: {
                            select: {
                                id: true,
                                title: true,
                                startDate: true,
                                endDate: true,
                                category: true,
                            }
                        }
                    },
                    take: 3
                },
                appointmentsAsExhibitor: {
                    where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
                    select: { id: true }
                },
                followersAsFollowed: {
                    select: { id: true }
                }
            }
        });
        // Calculate match score based on categories
        const formattedExhibitors = exhibitors.map(exhibitor => {
            const exhibitorCategories = new Set();
            exhibitor.exhibitorBooths?.forEach((booth) => {
                if (booth.event?.category && Array.isArray(booth.event.category)) {
                    booth.event.category.forEach((cat) => exhibitorCategories.add(cat));
                }
            });
            const matchingCategories = visitor.categories.filter(cat => Array.from(exhibitorCategories).some(exCat => exCat.toLowerCase().includes(cat.toLowerCase()) ||
                cat.toLowerCase().includes(exCat.toLowerCase())));
            const matchScore = matchingCategories.length;
            return {
                id: exhibitor.id,
                name: `${exhibitor.firstName || ""} ${exhibitor.lastName || ""}`.trim() || exhibitor.company || "Exhibitor",
                company: exhibitor.company,
                industry: exhibitor.companyIndustry,
                description: exhibitor.description,
                avatar: exhibitor.avatar,
                website: exhibitor.website,
                linkedin: exhibitor.linkedin,
                location: exhibitor.location,
                bio: exhibitor.bio,
                stats: {
                    totalMeetings: exhibitor.appointmentsAsExhibitor?.length || 0,
                    followers: exhibitor.followersAsFollowed?.length || 0,
                    products: 0,
                    upcomingEvents: exhibitor.exhibitorBooths?.length || 0,
                },
                upcomingEvents: exhibitor.exhibitorBooths?.map((booth) => ({
                    id: booth.event.id,
                    title: booth.event.title,
                    startDate: booth.event.startDate,
                })) || [],
                relevanceScore: matchScore,
            };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
        return formattedExhibitors;
    }
    catch (error) {
        console.error("Error in getAvailableExhibitorsForSuggestion:", error);
        throw error;
    }
}
async function getTrendingExhibitors(filters) {
    try {
        const { limit = 20, search } = filters;
        const where = {
            role: "EXHIBITOR",
            isActive: true,
        };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
            ];
        }
        const exhibitors = await prisma_1.default.user.findMany({
            where,
            take: limit,
            include: {
                appointmentsAsExhibitor: {
                    where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
                    select: { id: true }
                },
                followersAsFollowed: {
                    select: { id: true }
                },
                exhibitorBooths: {
                    where: {
                        event: {
                            status: "PUBLISHED",
                            startDate: { gte: new Date() }
                        }
                    },
                    include: {
                        event: {
                            select: {
                                id: true,
                                title: true,
                                startDate: true,
                                endDate: true,
                                category: true,
                            }
                        }
                    },
                    take: 3
                }
            },
            orderBy: [
                { createdAt: "desc" }
            ]
        });
        // Calculate trending score based on engagement
        const formattedExhibitors = exhibitors.map(exhibitor => {
            const meetingCount = exhibitor.appointmentsAsExhibitor?.length || 0;
            const followerCount = exhibitor.followersAsFollowed?.length || 0;
            const upcomingEvents = exhibitor.exhibitorBooths?.length || 0;
            const trendingScore = (meetingCount * 3) + (followerCount * 1) + (upcomingEvents * 2);
            return {
                id: exhibitor.id,
                name: `${exhibitor.firstName || ""} ${exhibitor.lastName || ""}`.trim() || exhibitor.company || "Exhibitor",
                company: exhibitor.company,
                industry: exhibitor.companyIndustry,
                description: exhibitor.description,
                avatar: exhibitor.avatar,
                website: exhibitor.website,
                linkedin: exhibitor.linkedin,
                location: exhibitor.location,
                bio: exhibitor.bio,
                stats: {
                    totalMeetings: meetingCount,
                    followers: followerCount,
                    products: 0,
                    upcomingEvents: upcomingEvents,
                },
                upcomingEvents: exhibitor.exhibitorBooths?.map((booth) => ({
                    id: booth.event.id,
                    title: booth.event.title,
                    startDate: booth.event.startDate,
                })) || [],
                relevanceScore: trendingScore,
            };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
        return formattedExhibitors;
    }
    catch (error) {
        console.error("Error in getTrendingExhibitors:", error);
        throw error;
    }
}
exports.default = router;
