"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminListNewsletterSubscribers = adminListNewsletterSubscribers;
exports.adminListNewsletterRecentEvents = adminListNewsletterRecentEvents;
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
        const take = req.query.limit ? Number(req.query.limit) : 40;
        const events = await (0, newsletter_service_1.listRecentEventsForNewsletter)(Number.isFinite(take) ? take : 40);
        return res.json({ success: true, events });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("admin newsletter recent-events", e);
        return res.status(500).json({ success: false, error: "Failed to load events" });
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
        const result = await (0, newsletter_service_1.sendNewsletterToActiveSubscribers)({
            eventIds,
            subject,
            sentByUserId: typeof sentByUserId === "string" ? sentByUserId : null,
            sentByEmail: typeof sentByEmail === "string" ? sentByEmail : null,
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
