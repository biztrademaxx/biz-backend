"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEmailCampaignsHandler = listEmailCampaignsHandler;
exports.createEmailCampaignHandler = createEmailCampaignHandler;
exports.listEmailTemplatesHandler = listEmailTemplatesHandler;
exports.createEmailTemplateHandler = createEmailTemplateHandler;
exports.deleteEmailTemplateHandler = deleteEmailTemplateHandler;
exports.listPushNotificationsHandler = listPushNotificationsHandler;
exports.createPushNotificationHandler = createPushNotificationHandler;
exports.listPushTemplatesHandler = listPushTemplatesHandler;
exports.createPushTemplateHandler = createPushTemplateHandler;
exports.deletePushTemplateHandler = deletePushTemplateHandler;
exports.trafficSummaryHandler = trafficSummaryHandler;
exports.listSeoKeywordsHandler = listSeoKeywordsHandler;
exports.createSeoKeywordHandler = createSeoKeywordHandler;
exports.deleteSeoKeywordHandler = deleteSeoKeywordHandler;
const service = __importStar(require("./marketing.service"));
async function listEmailCampaignsHandler(req, res) {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : "all";
        const data = await service.listEmailCampaigns(status);
        return res.json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to fetch email campaigns", details: error?.message });
    }
}
async function createEmailCampaignHandler(req, res) {
    try {
        const { title, subject, content } = req.body ?? {};
        if (!title || !subject || !content) {
            return res.status(400).json({ success: false, error: "title, subject, and content are required" });
        }
        const data = await service.createEmailCampaign(req.body ?? {});
        return res.status(201).json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to create email campaign", details: error?.message });
    }
}
async function listEmailTemplatesHandler(_req, res) {
    try {
        const category = typeof _req.query.category === "string" ? _req.query.category : "all";
        const data = service.listEmailTemplatesByCategory(category);
        return res.json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to fetch email templates", details: error?.message });
    }
}
async function createEmailTemplateHandler(req, res) {
    try {
        const { name, subject, content } = req.body ?? {};
        if (!name || !subject || !content) {
            return res.status(400).json({ success: false, error: "name, subject, and content are required" });
        }
        const data = service.createEmailTemplate(req.body ?? {});
        return res.status(201).json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to create email template", details: error?.message });
    }
}
async function deleteEmailTemplateHandler(req, res) {
    try {
        const id = req.params.id;
        const deleted = service.deleteEmailTemplate(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: "Email template not found" });
        }
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to delete email template", details: error?.message });
    }
}
async function listPushNotificationsHandler(req, res) {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : "all";
        const data = await service.listPushNotifications(status);
        return res.json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to fetch push notifications", details: error?.message });
    }
}
async function createPushNotificationHandler(req, res) {
    try {
        const { title, bodyText } = req.body ?? {};
        if (!title || !bodyText) {
            return res.status(400).json({ success: false, error: "title and bodyText are required" });
        }
        const data = service.createPushNotification(req.body ?? {});
        return res.status(201).json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to create push notification", details: error?.message });
    }
}
async function listPushTemplatesHandler(_req, res) {
    try {
        const category = typeof _req.query.category === "string" ? _req.query.category : "all";
        const data = service.listPushTemplatesByCategory(category);
        return res.json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to fetch push templates", details: error?.message });
    }
}
async function createPushTemplateHandler(req, res) {
    try {
        const { name, title, message } = req.body ?? {};
        if (!name || !title || !message) {
            return res.status(400).json({ success: false, error: "name, title, and message are required" });
        }
        const data = service.createPushTemplate(req.body ?? {});
        return res.status(201).json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to create push template", details: error?.message });
    }
}
async function deletePushTemplateHandler(req, res) {
    try {
        const id = req.params.id;
        const deleted = service.deletePushTemplate(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: "Push template not found" });
        }
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to delete push template", details: error?.message });
    }
}
async function trafficSummaryHandler(_req, res) {
    try {
        const data = await service.getMarketingTrafficSummaryAsync();
        return res.json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to fetch traffic summary", details: error?.message });
    }
}
async function listSeoKeywordsHandler(_req, res) {
    try {
        const data = await service.listSeoKeywords();
        return res.json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to fetch SEO keywords", details: error?.message });
    }
}
async function createSeoKeywordHandler(req, res) {
    try {
        const { keyword } = req.body ?? {};
        if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
            return res.status(400).json({ success: false, error: "keyword is required" });
        }
        const data = await service.createSeoKeyword(req.body ?? {});
        return res.status(201).json({ success: true, data });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to create SEO keyword", details: error?.message });
    }
}
async function deleteSeoKeywordHandler(req, res) {
    try {
        const id = req.params.id;
        const deleted = await service.deleteSeoKeyword(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: "SEO keyword not found" });
        }
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: "Failed to delete SEO keyword", details: error?.message });
    }
}
