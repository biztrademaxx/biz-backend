"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEmailCampaigns = listEmailCampaigns;
exports.createEmailCampaign = createEmailCampaign;
exports.listEmailTemplates = listEmailTemplates;
exports.listEmailTemplatesByCategory = listEmailTemplatesByCategory;
exports.createEmailTemplate = createEmailTemplate;
exports.deleteEmailTemplate = deleteEmailTemplate;
exports.listPushNotifications = listPushNotifications;
exports.createPushNotification = createPushNotification;
exports.listPushTemplates = listPushTemplates;
exports.listPushTemplatesByCategory = listPushTemplatesByCategory;
exports.createPushTemplate = createPushTemplate;
exports.deletePushTemplate = deletePushTemplate;
exports.getMarketingTrafficSummaryAsync = getMarketingTrafficSummaryAsync;
exports.listSeoKeywords = listSeoKeywords;
exports.createSeoKeyword = createSeoKeyword;
exports.deleteSeoKeyword = deleteSeoKeyword;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const email_service_1 = require("../../../services/email.service");
const templatesStore = [
    {
        id: "welcome",
        name: "Welcome Campaign",
        subject: "Welcome to our event platform",
        content: "Hello! We are excited to have you with us. Stay tuned for updates.",
        category: "onboarding",
    },
    {
        id: "announcement",
        name: "Event Announcement",
        subject: "New event announcement",
        content: "A new event has been published. Check details and register now.",
        category: "marketing",
    },
];
const pushTemplatesStore = [
    {
        id: "reminder",
        name: "Event Reminder",
        title: "Your event starts soon",
        message: "Reminder: your registered event will start shortly. See you there!",
        category: "engagement",
    },
    {
        id: "announcement",
        name: "General Announcement",
        title: "New update available",
        message: "Check out the latest platform updates and new opportunities.",
        category: "marketing",
    },
];
async function listEmailCampaigns(status) {
    const where = !status || status === "all" ? {} : { status: status.toLowerCase() };
    const rows = await prisma_1.default.emailCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        content: row.content,
        status: row.status,
        priority: row.priority,
        targetAudiences: Array.isArray(row.targetAudiences) ? row.targetAudiences.map(String) : [],
        createdAt: row.createdAt.toISOString(),
        scheduledAt: row.scheduledAt?.toISOString(),
        sentAt: row.sentAt?.toISOString(),
        stats: {
            totalRecipients: row.totalRecipients,
            sent: row.sent,
            delivered: row.delivered,
            opened: row.opened,
            clicked: row.clicked,
            bounced: row.bounced,
            unsubscribed: row.unsubscribed,
        },
        engagement: {
            openRate: row.openRate,
            clickRate: row.clickRate,
            deliveryRate: row.deliveryRate,
        },
    }));
}
async function createEmailCampaign(input) {
    const nowIso = new Date().toISOString();
    const sendNow = !!input.sendImmediately;
    const recipients = await prisma_1.default.user.findMany({
        where: {
            email: { not: "" },
            isActive: true,
        },
        select: { email: true },
    });
    const uniqueEmails = Array.from(new Set(recipients.map((r) => String(r.email || "").trim()).filter(Boolean)));
    let sent = 0;
    let failed = 0;
    if (sendNow && uniqueEmails.length > 0) {
        const mailResults = await Promise.allSettled(uniqueEmails.map((email) => (0, email_service_1.sendMarketingEmail)({
            to: email,
            subject: input.subject,
            content: input.content,
            htmlContent: input.htmlContent,
        })));
        sent = mailResults.filter((r) => r.status === "fulfilled").length;
        failed = mailResults.length - sent;
    }
    const created = await prisma_1.default.emailCampaign.create({
        data: {
            title: input.title,
            subject: input.subject,
            content: input.content,
            htmlContent: input.htmlContent,
            status: sendNow ? "sending" : "scheduled",
            priority: input.priority || "medium",
            targetAudiences: Array.isArray(input.targetAudiences) ? input.targetAudiences : [],
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            sentAt: sendNow ? new Date(nowIso) : null,
            totalRecipients: uniqueEmails.length,
            sent,
            delivered: sent,
            opened: 0,
            clicked: 0,
            bounced: failed,
            unsubscribed: 0,
            openRate: 0,
            clickRate: 0,
            deliveryRate: uniqueEmails.length > 0 ? Number(((sent / uniqueEmails.length) * 100).toFixed(2)) : 0,
            bounceRate: uniqueEmails.length > 0 ? Number(((failed / uniqueEmails.length) * 100).toFixed(2)) : 0,
            unsubscribeRate: 0,
        },
    });
    const item = {
        id: created.id,
        title: input.title,
        subject: input.subject,
        content: input.content,
        status: sendNow ? "sending" : "scheduled",
        priority: input.priority || "medium",
        targetAudiences: Array.isArray(input.targetAudiences) ? input.targetAudiences : [],
        createdAt: nowIso,
        scheduledAt: input.scheduledAt || undefined,
        sentAt: sendNow ? nowIso : undefined,
        stats: {
            totalRecipients: uniqueEmails.length,
            sent,
            delivered: sent,
            opened: 0,
            clicked: 0,
            bounced: failed,
            unsubscribed: 0,
        },
        engagement: {
            openRate: 0,
            clickRate: 0,
            deliveryRate: uniqueEmails.length > 0 ? Number(((sent / uniqueEmails.length) * 100).toFixed(2)) : 0,
        },
    };
    return item;
}
function listEmailTemplates() {
    return templatesStore;
}
function listEmailTemplatesByCategory(category) {
    if (!category || category === "all")
        return templatesStore;
    const normalized = category.toLowerCase();
    return templatesStore.filter((t) => (t.category || "").toLowerCase() === normalized);
}
function createEmailTemplate(input) {
    const nowIso = new Date().toISOString();
    const template = {
        id: `${Date.now()}`,
        name: input.name,
        subject: input.subject,
        content: input.content,
        category: input.category || "promotional",
        htmlContent: input.htmlContent || "",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
    };
    templatesStore.unshift(template);
    return template;
}
function deleteEmailTemplate(id) {
    const idx = templatesStore.findIndex((t) => t.id === id);
    if (idx === -1)
        return false;
    templatesStore.splice(idx, 1);
    return true;
}
async function listPushNotifications(status) {
    const where = !status || status === "all" ? {} : { status: status.toLowerCase() };
    const rows = await prisma_1.default.pushNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.message,
        status: row.status,
        priority: row.priority,
        targetAudiences: Array.isArray(row.targetAudiences) ? row.targetAudiences.map(String) : [],
        createdAt: row.createdAt.toISOString(),
        scheduledAt: row.scheduledAt?.toISOString(),
        sentAt: row.sentAt?.toISOString(),
        stats: {
            totalRecipients: row.totalRecipients,
            sent: row.sent,
            delivered: row.delivered,
            opened: row.opened,
            clicked: row.clicked,
            failed: row.failed,
        },
        engagement: {
            openRate: row.openRate,
            clickRate: row.clickRate,
            deliveryRate: row.deliveryRate,
        },
    }));
}
async function createPushNotification(input) {
    const nowIso = new Date().toISOString();
    const sendNow = !!input.sendImmediately;
    const created = await prisma_1.default.pushNotification.create({
        data: {
            title: input.title,
            message: input.bodyText,
            status: sendNow ? "sending" : "scheduled",
            priority: input.priority || "medium",
            targetAudiences: Array.isArray(input.targetAudiences) ? input.targetAudiences : [],
            targetPlatforms: Array.isArray(input.targetPlatforms) ? input.targetPlatforms : ["ios", "android", "web"],
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            sentAt: sendNow ? new Date(nowIso) : null,
        },
    });
    const item = {
        id: created.id,
        title: input.title,
        body: input.bodyText,
        status: sendNow ? "sending" : "scheduled",
        priority: input.priority || "medium",
        targetAudiences: Array.isArray(input.targetAudiences) ? input.targetAudiences : [],
        createdAt: nowIso,
        scheduledAt: input.scheduledAt || undefined,
        sentAt: sendNow ? nowIso : undefined,
        stats: {
            totalRecipients: 0,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            failed: 0,
        },
        engagement: {
            openRate: 0,
            clickRate: 0,
            deliveryRate: 0,
        },
    };
    return item;
}
function listPushTemplates() {
    return pushTemplatesStore;
}
function listPushTemplatesByCategory(category) {
    if (!category || category === "all")
        return pushTemplatesStore;
    const normalized = category.toLowerCase();
    return pushTemplatesStore.filter((t) => (t.category || "").toLowerCase() === normalized);
}
function createPushTemplate(input) {
    const nowIso = new Date().toISOString();
    const item = {
        id: `${Date.now()}`,
        name: input.name,
        title: input.title,
        message: input.message,
        imageUrl: input.imageUrl || "",
        category: input.category || "promotional",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
    };
    pushTemplatesStore.unshift(item);
    return item;
}
function deletePushTemplate(id) {
    const idx = pushTemplatesStore.findIndex((t) => t.id === id);
    if (idx === -1)
        return false;
    pushTemplatesStore.splice(idx, 1);
    return true;
}
async function getMarketingTrafficSummaryAsync() {
    const [emailCount, pushCount, emailAgg, pushAgg] = await Promise.all([
        prisma_1.default.emailCampaign.count(),
        prisma_1.default.pushNotification.count(),
        prisma_1.default.emailCampaign.aggregate({ _sum: { sent: true, delivered: true, opened: true, clicked: true } }),
        prisma_1.default.pushNotification.aggregate({ _sum: { sent: true, delivered: true, opened: true, clicked: true } }),
    ]);
    const emailTotals = {
        sent: emailAgg._sum.sent ?? 0,
        delivered: emailAgg._sum.delivered ?? 0,
        opened: emailAgg._sum.opened ?? 0,
        clicked: emailAgg._sum.clicked ?? 0,
    };
    const pushTotals = {
        sent: pushAgg._sum.sent ?? 0,
        delivered: pushAgg._sum.delivered ?? 0,
        opened: pushAgg._sum.opened ?? 0,
        clicked: pushAgg._sum.clicked ?? 0,
    };
    const sent = emailTotals.sent + pushTotals.sent;
    const delivered = emailTotals.delivered + pushTotals.delivered;
    const opened = emailTotals.opened + pushTotals.opened;
    const clicked = emailTotals.clicked + pushTotals.clicked;
    return {
        totals: {
            emailCampaigns: emailCount,
            pushNotifications: pushCount,
            sent,
            delivered,
            opened,
            clicked,
        },
        rates: {
            openRate: delivered > 0 ? Number(((opened / delivered) * 100).toFixed(2)) : 0,
            clickRate: delivered > 0 ? Number(((clicked / delivered) * 100).toFixed(2)) : 0,
            deliveryRate: sent > 0 ? Number(((delivered / sent) * 100).toFixed(2)) : 0,
        },
        channels: {
            email: emailTotals,
            push: pushTotals,
        },
    };
}
async function listSeoKeywords() {
    const rows = await prisma_1.default.seoKeyword.findMany({ orderBy: { updatedAt: "desc" } });
    return rows.map((row) => ({
        id: row.id,
        keyword: row.keyword,
        intent: row.intent,
        volume: row.volume,
        difficulty: row.difficulty,
        priority: row.priority,
        updatedAt: row.updatedAt.toISOString(),
    }));
}
async function createSeoKeyword(input) {
    const row = await prisma_1.default.seoKeyword.upsert({
        where: { keyword: input.keyword.trim() },
        update: {
            intent: input.intent || "long-tail",
            volume: Number.isFinite(input.volume) ? Number(input.volume) : 0,
            difficulty: Number.isFinite(input.difficulty) ? Number(input.difficulty) : 0,
            priority: input.priority || "medium",
        },
        create: {
            keyword: input.keyword.trim(),
            intent: input.intent || "long-tail",
            volume: Number.isFinite(input.volume) ? Number(input.volume) : 0,
            difficulty: Number.isFinite(input.difficulty) ? Number(input.difficulty) : 0,
            priority: input.priority || "medium",
        },
    });
    return {
        id: row.id,
        keyword: row.keyword,
        intent: row.intent,
        volume: row.volume,
        difficulty: row.difficulty,
        priority: row.priority,
        updatedAt: row.updatedAt.toISOString(),
    };
}
async function deleteSeoKeyword(id) {
    const found = await prisma_1.default.seoKeyword.findUnique({ where: { id } });
    if (!found)
        return false;
    await prisma_1.default.seoKeyword.delete({ where: { id } });
    return true;
}
