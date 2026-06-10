"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEWSLETTER_DATE_WINDOWS = void 0;
exports.parseNewsletterDateWindow = parseNewsletterDateWindow;
exports.parseNewsletterAudience = parseNewsletterAudience;
exports.normalizeNewsletterEmail = normalizeNewsletterEmail;
exports.subscribeNewsletter = subscribeNewsletter;
exports.listNewsletterSubscribers = listNewsletterSubscribers;
exports.listNewsletterCategories = listNewsletterCategories;
exports.listRecentEventsForNewsletter = listRecentEventsForNewsletter;
exports.previewNewsletterRecipients = previewNewsletterRecipients;
exports.sendNewsletterToActiveSubscribers = sendNewsletterToActiveSubscribers;
exports.listRecentCampaigns = listRecentCampaigns;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const email_service_1 = require("../../../services/email.service");
const ACTIVE = "ACTIVE";
const UNSUBSCRIBED = "UNSUBSCRIBED";
/** Upcoming events whose startDate falls within this many days from today. */
exports.NEWSLETTER_DATE_WINDOWS = {
    all: null,
    "30d": 30,
    "2m": 60,
    "3m": 90,
    "5m": 150,
    "8m": 240,
    "1y": 365,
};
function parseNewsletterDateWindow(raw) {
    const key = String(raw ?? "all").trim().toLowerCase();
    if (key in exports.NEWSLETTER_DATE_WINDOWS)
        return key;
    return "all";
}
function parseNewsletterAudience(raw) {
    const key = String(raw ?? "both").trim().toLowerCase();
    if (key === "subscribers" || key === "visitors" || key === "both")
        return key;
    return "both";
}
function normalizeCategoryLabel(s) {
    return s.trim().toLowerCase();
}
function categoryLabelsOverlap(a, b) {
    if (a.length === 0 || b.length === 0)
        return false;
    const setB = new Set(b.map(normalizeCategoryLabel));
    return a.some((x) => setB.has(normalizeCategoryLabel(x)));
}
function eventMatchesCategory(eventCategories, category) {
    if (!category?.trim())
        return true;
    const target = normalizeCategoryLabel(category);
    return eventCategories.some((c) => normalizeCategoryLabel(c) === target);
}
function recipientMatchesCategory(interests, category) {
    if (!category?.trim())
        return true;
    const target = normalizeCategoryLabel(category);
    return interests.some((i) => normalizeCategoryLabel(i) === target);
}
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function dateWindowEnd(window) {
    const days = exports.NEWSLETTER_DATE_WINDOWS[window];
    if (days == null)
        return null;
    const end = new Date();
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);
    return end;
}
function normalizeNewsletterEmail(s) {
    if (typeof s !== "string")
        return null;
    const t = s.trim().toLowerCase();
    if (!t || t.length > 254)
        return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))
        return null;
    return t;
}
async function subscribeNewsletter(email) {
    const existing = await prisma_1.default.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
        if (existing.status === ACTIVE) {
            return { ok: true, reactivated: false };
        }
        await prisma_1.default.newsletterSubscriber.update({
            where: { email },
            data: { status: ACTIVE, unsubscribedAt: null, source: "footer" },
        });
        return { ok: true, reactivated: true };
    }
    await prisma_1.default.newsletterSubscriber.create({
        data: { email, status: ACTIVE, source: "footer" },
    });
    return { ok: true, reactivated: false };
}
async function listNewsletterSubscribers(params) {
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));
    const skip = (page - 1) * limit;
    const where = { status: ACTIVE };
    const [rows, total] = await Promise.all([
        prisma_1.default.newsletterSubscriber.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id: true,
                email: true,
                status: true,
                source: true,
                createdAt: true,
            },
        }),
        prisma_1.default.newsletterSubscriber.count({ where }),
    ]);
    return {
        data: rows.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
    };
}
async function listNewsletterCategories() {
    const rows = await prisma_1.default.eventCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });
    return rows;
}
async function listRecentEventsForNewsletter(params) {
    const n = Math.min(120, Math.max(1, params.take));
    const window = params.window ?? "all";
    const today = startOfToday();
    const windowEnd = dateWindowEnd(window);
    const startDateFilter = { gte: today };
    if (windowEnd)
        startDateFilter.lte = windowEnd;
    const where = {
        status: "PUBLISHED",
        isPublic: true,
        startDate: startDateFilter,
    };
    const category = String(params.category ?? "").trim();
    if (category) {
        where.category = { has: category };
    }
    const events = await prisma_1.default.event.findMany({
        where,
        orderBy: { startDate: "asc" },
        take: n,
        select: {
            id: true,
            title: true,
            shortDescription: true,
            slug: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            state: true,
            category: true,
            thumbnailImage: true,
            bannerImage: true,
            isVirtual: true,
            venue: {
                select: {
                    venueName: true,
                    venueCity: true,
                    venueCountry: true,
                },
            },
        },
    });
    return events.map((e) => ({
        id: e.id,
        title: e.title,
        shortDescription: e.shortDescription,
        slug: e.slug,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        city: e.city || e.venue?.venueCity || null,
        state: e.state || null,
        country: e.country || e.venue?.venueCountry || null,
        venueName: e.venue?.venueName || null,
        category: e.category ?? [],
        thumbnailImage: e.thumbnailImage,
        bannerImage: e.bannerImage,
        isVirtual: e.isVirtual,
    }));
}
async function previewNewsletterRecipients(params) {
    const recipients = await resolveNewsletterRecipients(params);
    const subscribers = recipients.filter((r) => r.source === "subscriber").length;
    const visitors = recipients.filter((r) => r.source === "visitor").length;
    return {
        total: recipients.length,
        subscribers,
        visitors,
        category: params.category?.trim() || null,
        personalized: Boolean(params.personalized),
    };
}
async function resolveNewsletterRecipients(params) {
    const category = params.category?.trim() || null;
    const byEmail = new Map();
    const includeSubscribers = params.audience === "subscribers" || params.audience === "both";
    const includeVisitors = params.audience === "visitors" || params.audience === "both";
    if (includeSubscribers) {
        const subs = await prisma_1.default.newsletterSubscriber.findMany({
            where: { status: ACTIVE },
            select: { email: true },
        });
        for (const sub of subs) {
            const email = sub.email.trim().toLowerCase();
            if (!email)
                continue;
            // Subscribers have no stored interests — include when not filtering by category.
            if (category)
                continue;
            byEmail.set(email, { email: sub.email, interests: [], source: "subscriber" });
        }
    }
    if (includeVisitors) {
        const visitors = await prisma_1.default.user.findMany({
            where: {
                role: "ATTENDEE",
                isActive: true,
                emailNotifications: true,
                email: { not: null },
            },
            select: { email: true, interests: true },
        });
        for (const v of visitors) {
            const email = String(v.email ?? "").trim().toLowerCase();
            if (!email)
                continue;
            const interests = Array.isArray(v.interests) ? v.interests : [];
            if (category && !recipientMatchesCategory(interests, category))
                continue;
            if (params.personalized && interests.length === 0)
                continue;
            byEmail.set(email, {
                email: String(v.email),
                interests,
                source: "visitor",
            });
        }
    }
    return [...byEmail.values()];
}
async function sendNewsletterToActiveSubscribers(params) {
    const uniqueIds = [...new Set(params.eventIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
        throw Object.assign(new Error("Select at least one event."), { status: 400 });
    }
    if (uniqueIds.length > 25) {
        throw Object.assign(new Error("You can select at most 25 events per send."), { status: 400 });
    }
    const eventsRaw = await prisma_1.default.event.findMany({
        where: {
            id: { in: uniqueIds },
            status: "PUBLISHED",
            isPublic: true,
        },
        select: {
            id: true,
            title: true,
            shortDescription: true,
            slug: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            state: true,
            category: true,
            thumbnailImage: true,
            bannerImage: true,
            isVirtual: true,
            venue: {
                select: { venueName: true, venueCity: true, venueCountry: true },
            },
        },
    });
    if (eventsRaw.length !== uniqueIds.length) {
        throw Object.assign(new Error("One or more events are missing, not published, or not public."), { status: 400 });
    }
    const order = new Map(uniqueIds.map((id, i) => [id, i]));
    eventsRaw.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const events = eventsRaw.map((e) => ({
        id: e.id,
        title: e.title,
        shortDescription: e.shortDescription,
        slug: e.slug,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        city: e.city || e.venue?.venueCity || null,
        state: e.state || null,
        country: e.country || e.venue?.venueCountry || null,
        venueName: e.venue?.venueName || null,
        category: e.category ?? [],
        thumbnailImage: e.thumbnailImage,
        bannerImage: e.bannerImage,
        isVirtual: e.isVirtual,
    }));
    const audience = params.audience ?? "both";
    const category = params.category?.trim() || null;
    const personalized = Boolean(params.personalized);
    const recipients = await resolveNewsletterRecipients({
        audience,
        category,
        personalized,
    });
    const MAX_RECIPIENTS = 2000;
    if (recipients.length === 0) {
        throw Object.assign(new Error("No recipients match your audience and category filters."), { status: 400 });
    }
    if (recipients.length > MAX_RECIPIENTS) {
        throw Object.assign(new Error(`Too many recipients (${recipients.length}). Contact support to raise the limit.`), { status: 400 });
    }
    const campaign = await prisma_1.default.newsletterCampaign.create({
        data: {
            subject: params.subject,
            eventIds: uniqueIds,
            recipientCount: recipients.length,
            sentSucceeded: 0,
            sentFailed: 0,
            sentByUserId: params.sentByUserId,
            sentByEmail: params.sentByEmail,
        },
    });
    let sentSucceeded = 0;
    let sentFailed = 0;
    let skippedNoMatch = 0;
    for (const recipient of recipients) {
        let eventsForRecipient = events;
        if (category) {
            eventsForRecipient = eventsForRecipient.filter((ev) => eventMatchesCategory(ev.category, category));
        }
        if (personalized && recipient.interests.length > 0) {
            eventsForRecipient = eventsForRecipient.filter((ev) => categoryLabelsOverlap(ev.category, recipient.interests));
        }
        if (eventsForRecipient.length === 0) {
            skippedNoMatch += 1;
            continue;
        }
        try {
            // eslint-disable-next-line no-await-in-loop
            await (0, email_service_1.sendNewsletterDigestEmail)({
                to: recipient.email,
                subject: params.subject,
                events: eventsForRecipient,
            });
            sentSucceeded += 1;
        }
        catch {
            sentFailed += 1;
        }
    }
    await prisma_1.default.newsletterCampaign.update({
        where: { id: campaign.id },
        data: { sentSucceeded, sentFailed },
    });
    return {
        campaignId: campaign.id,
        recipientCount: recipients.length,
        sentSucceeded,
        sentFailed,
        skippedNoMatch,
        events,
    };
}
async function listRecentCampaigns(take) {
    const n = Math.min(50, Math.max(1, take));
    const rows = await prisma_1.default.newsletterCampaign.findMany({
        orderBy: { createdAt: "desc" },
        take: n,
    });
    return rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        eventIds: r.eventIds,
        recipientCount: r.recipientCount,
        sentSucceeded: r.sentSucceeded,
        sentFailed: r.sentFailed,
        sentByEmail: r.sentByEmail,
        createdAt: r.createdAt.toISOString(),
    }));
}
