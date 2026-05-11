import { Request, Response } from "express";
import * as service from "./marketing.service";

export async function listEmailCampaignsHandler(req: Request, res: Response) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const data = await service.listEmailCampaigns(status);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch email campaigns", details: error?.message });
  }
}

export async function createEmailCampaignHandler(req: Request, res: Response) {
  try {
    const { title, subject, content } = req.body ?? {};
    if (!title || !subject || !content) {
      return res.status(400).json({ success: false, error: "title, subject, and content are required" });
    }
    const data = await service.createEmailCampaign(req.body ?? {});
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to create email campaign", details: error?.message });
  }
}

export async function listEmailTemplatesHandler(_req: Request, res: Response) {
  try {
    const category = typeof _req.query.category === "string" ? _req.query.category : "all";
    const data = service.listEmailTemplatesByCategory(category);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch email templates", details: error?.message });
  }
}

export async function createEmailTemplateHandler(req: Request, res: Response) {
  try {
    const { name, subject, content } = req.body ?? {};
    if (!name || !subject || !content) {
      return res.status(400).json({ success: false, error: "name, subject, and content are required" });
    }
    const data = service.createEmailTemplate(req.body ?? {});
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to create email template", details: error?.message });
  }
}

export async function deleteEmailTemplateHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const deleted = service.deleteEmailTemplate(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Email template not found" });
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to delete email template", details: error?.message });
  }
}

export async function listPushNotificationsHandler(req: Request, res: Response) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const data = await service.listPushNotifications(status);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch push notifications", details: error?.message });
  }
}

export async function createPushNotificationHandler(req: Request, res: Response) {
  try {
    const { title, bodyText } = req.body ?? {};
    if (!title || !bodyText) {
      return res.status(400).json({ success: false, error: "title and bodyText are required" });
    }
    const data = service.createPushNotification(req.body ?? {});
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to create push notification", details: error?.message });
  }
}

export async function listPushTemplatesHandler(_req: Request, res: Response) {
  try {
    const category = typeof _req.query.category === "string" ? _req.query.category : "all";
    const data = service.listPushTemplatesByCategory(category);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch push templates", details: error?.message });
  }
}

export async function createPushTemplateHandler(req: Request, res: Response) {
  try {
    const { name, title, message } = req.body ?? {};
    if (!name || !title || !message) {
      return res.status(400).json({ success: false, error: "name, title, and message are required" });
    }
    const data = service.createPushTemplate(req.body ?? {});
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to create push template", details: error?.message });
  }
}

export async function deletePushTemplateHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const deleted = service.deletePushTemplate(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Push template not found" });
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to delete push template", details: error?.message });
  }
}

export async function trafficSummaryHandler(_req: Request, res: Response) {
  try {
    const data = await service.getMarketingTrafficSummaryAsync();
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch traffic summary", details: error?.message });
  }
}

export async function listSeoKeywordsHandler(_req: Request, res: Response) {
  try {
    const data = await service.listSeoKeywords();
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to fetch SEO keywords", details: error?.message });
  }
}

export async function createSeoKeywordHandler(req: Request, res: Response) {
  try {
    const { keyword } = req.body ?? {};
    if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
      return res.status(400).json({ success: false, error: "keyword is required" });
    }
    const data = await service.createSeoKeyword(req.body ?? {});
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to create SEO keyword", details: error?.message });
  }
}

export async function deleteSeoKeywordHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const deleted = await service.deleteSeoKeyword(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "SEO keyword not found" });
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to delete SEO keyword", details: error?.message });
  }
}
