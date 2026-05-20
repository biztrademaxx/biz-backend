"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeNewsletterEmail = normalizeNewsletterEmail;
exports.subscribeNewsletter = subscribeNewsletter;
exports.listNewsletterSubscribers = listNewsletterSubscribers;
exports.listRecentEventsForNewsletter = listRecentEventsForNewsletter;
exports.sendNewsletterToActiveSubscribers = sendNewsletterToActiveSubscribers;
exports.listRecentCampaigns = listRecentCampaigns;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const email_service_1 = require("../../../services/email.service");
const ACTIVE = "ACTIVE";
const UNSUBSCRIBED = "UNSUBSCRIBED";
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
async function listRecentEventsForNewsletter(take) {
    const n = Math.min(60, Math.max(1, take));
    const events = await prisma_1.default.event.findMany({
        where: {
            status: "PUBLISHED",
            isPublic: true,
        },
        orderBy: { startDate: "desc" },
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
        thumbnailImage: e.thumbnailImage,
        bannerImage: e.bannerImage,
        isVirtual: e.isVirtual,
    }));
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
        thumbnailImage: e.thumbnailImage,
        bannerImage: e.bannerImage,
        isVirtual: e.isVirtual,
    }));
    const subscribers = await prisma_1.default.newsletterSubscriber.findMany({
        where: { status: ACTIVE },
        select: { email: true },
    });
    const MAX_RECIPIENTS = 2000;
    if (subscribers.length === 0) {
        throw Object.assign(new Error("There are no active subscribers to email."), { status: 400 });
    }
    if (subscribers.length > MAX_RECIPIENTS) {
        throw Object.assign(new Error(`Too many active subscribers (${subscribers.length}). Contact support to raise the limit.`), { status: 400 });
    }
    const campaign = await prisma_1.default.newsletterCampaign.create({
        data: {
            subject: params.subject,
            eventIds: uniqueIds,
            recipientCount: subscribers.length,
            sentSucceeded: 0,
            sentFailed: 0,
            sentByUserId: params.sentByUserId,
            sentByEmail: params.sentByEmail,
        },
    });
    let sentSucceeded = 0;
    let sentFailed = 0;
    for (const sub of subscribers) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await (0, email_service_1.sendNewsletterDigestEmail)({
                to: sub.email,
                subject: params.subject,
                events,
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
        recipientCount: subscribers.length,
        sentSucceeded,
        sentFailed,
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
