"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminListNewsletterSubscribers = adminListNewsletterSubscribers;
exports.adminListNewsletterRecentEvents = adminListNewsletterRecentEvents;
exports.adminListNewsletterCategories = adminListNewsletterCategories;
exports.adminPreviewNewsletterRecipients = adminPreviewNewsletterRecipients;
exports.adminListNewsletterCampaigns = adminListNewsletterCampaigns;
exports.adminSendNewsletter = adminSendNewsletter;
exports.publicNewsletterSubscribe = publicNewsletterSubscribe;
const newsletter_service_1 = require("./newsletter.service");
const email_service_1 = require("../../../services/email.service");
async function adminListNewsletterSubscribers(req, res) {
    try {
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const data = await (0, newsletter_service_1.listNewsletterSubscribers)({
            page: Number.isFinite(page) ? page : 1,
            limit: Number.isFinite(limit) ? limit : 50,
        });
        return res.json({ success: true, ...data });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("admin newsletter subscribers", e);
        return res.status(500).json({ success: false, error: "Failed to load subscribers" });
    }
}
async function adminListNewsletterRecentEvents(req, res) {
    try {
        const take = req.query.limit ? Number(req.query.limit) : 80;
        const window = (0, newsletter_service_1.parseNewsletterDateWindow)(req.query.window);
        const category = typeof req.query.category === "string" && req.query.category.trim()
            ? req.query.category.trim()
            : null;
        const events = await (0, newsletter_service_1.listRecentEventsForNewsletter)({
            take: Number.isFinite(take) ? take : 80,
            window,
            category,
        });
        return res.json({ success: true, events, window, category });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("admin newsletter recent-events", e);
        return res.status(500).json({ success: false, error: "Failed to load events" });
    }
}
async function adminListNewsletterCategories(_req, res) {
    try {
        const categories = await (0, newsletter_service_1.listNewsletterCategories)();
        return res.json({ success: true, categories });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("admin newsletter categories", e);
        return res.status(500).json({ success: false, error: "Failed to load categories" });
    }
}
async function adminPreviewNewsletterRecipients(req, res) {
    try {
        const audience = (0, newsletter_service_1.parseNewsletterAudience)(req.query.audience);
        const category = typeof req.query.category === "string" && req.query.category.trim()
            ? req.query.category.trim()
            : null;
        const personalized = String(req.query.personalized ?? "").toLowerCase() === "true";
        const preview = await (0, newsletter_service_1.previewNewsletterRecipients)({ audience, category, personalized });
        return res.json({ success: true, ...preview });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("admin newsletter recipient-preview", e);
        return res.status(500).json({ success: false, error: "Failed to preview recipients" });
    }
}
async function adminListNewsletterCampaigns(req, res) {
    try {
        const take = req.query.limit ? Number(req.query.limit) : 20;
        const campaigns = await (0, newsletter_service_1.listRecentCampaigns)(Number.isFinite(take) ? take : 20);
        return res.json({ success: true, campaigns });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("admin newsletter campaigns", e);
        return res.status(500).json({ success: false, error: "Failed to load campaigns" });
    }
}
async function adminSendNewsletter(req, res) {
    try {
        const body = req.body ?? {};
        const rawIds = body.eventIds;
        if (!Array.isArray(rawIds) || rawIds.length === 0) {
            return res.status(400).json({ success: false, error: "eventIds must be a non-empty array of event UUIDs." });
        }
        const eventIds = rawIds.map((x) => String(x ?? "").trim()).filter(Boolean);
        const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
        const subject = subjectRaw.length > 0 ? subjectRaw.slice(0, 200) : "Curated events from BizTradeFairs";
        const sentByUserId = req.auth?.sub ?? null;
        const sentByEmail = req.auth?.email ?? null;
        const audience = (0, newsletter_service_1.parseNewsletterAudience)(body.audience);
        const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
        const personalized = Boolean(body.personalized);
        const result = await (0, newsletter_service_1.sendNewsletterToActiveSubscribers)({
            eventIds,
            subject,
            sentByUserId: typeof sentByUserId === "string" ? sentByUserId : null,
            sentByEmail: typeof sentByEmail === "string" ? sentByEmail : null,
            audience,
            category,
            personalized,
        });
        return res.json({ success: true, ...result });
    }
    catch (e) {
        const status = typeof e?.status === "number" ? e.status : 500;
        // eslint-disable-next-line no-console
        console.error("admin newsletter send", e);
        const message = e instanceof Error ? e.message : "Send failed";
        return res.status(status).json({ success: false, error: message });
    }
}
/** POST /api/newsletter/subscribe — public, body: { email } */
async function publicNewsletterSubscribe(req, res) {
    try {
        const email = (0, newsletter_service_1.normalizeNewsletterEmail)(req.body?.email);
        if (!email) {
            return res.status(400).json({ success: false, error: "Please enter a valid email address." });
        }
        await (0, newsletter_service_1.subscribeNewsletter)(email);
        try {
            await (0, email_service_1.sendNewsletterWelcomeEmail)(email);
        }
        catch (welcomeErr) {
            // eslint-disable-next-line no-console
            console.error("[newsletter/subscribe] welcome email failed", welcomeErr);
        }
        return res.status(201).json({ success: true, message: "Thanks — you’re subscribed." });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("newsletter subscribe", e);
        return res.status(500).json({ success: false, error: "Could not subscribe right now. Please try again later." });
    }
}
