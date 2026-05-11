import prisma from "../../../config/prisma";
import { sendMarketingEmail } from "../../../services/email.service";

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";
type CampaignPriority = "low" | "medium" | "high";

export interface EmailCampaignItem {
  id: string;
  title: string;
  subject: string;
  content: string;
  status: CampaignStatus;
  priority: CampaignPriority;
  targetAudiences: string[];
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
  stats: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  engagement: {
    openRate: number;
    clickRate: number;
    deliveryRate: number;
  };
}

export interface EmailTemplateItem {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: string;
}

export interface PushNotificationItem {
  id: string;
  title: string;
  body: string;
  status: CampaignStatus;
  priority: CampaignPriority;
  targetAudiences: string[];
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
  stats: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
  engagement: {
    openRate: number;
    clickRate: number;
    deliveryRate: number;
  };
}

export interface PushTemplateItem {
  id: string;
  name: string;
  title: string;
  message: string;
  imageUrl?: string;
  category: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const templatesStore: EmailTemplateItem[] = [
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

const pushTemplatesStore: PushTemplateItem[] = [
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

export async function listEmailCampaigns(status?: string): Promise<EmailCampaignItem[]> {
  const where = !status || status === "all" ? {} : { status: status.toLowerCase() };
  const rows = await prisma.emailCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject,
    content: row.content,
    status: row.status as CampaignStatus,
    priority: row.priority as CampaignPriority,
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

export async function createEmailCampaign(input: {
  title: string;
  subject: string;
  content: string;
  htmlContent?: string;
  priority?: string;
  targetAudiences?: string[];
  scheduledAt?: string;
  sendImmediately?: boolean;
}): Promise<EmailCampaignItem> {
  const nowIso = new Date().toISOString();
  const sendNow = !!input.sendImmediately;
  const recipients = await prisma.user.findMany({
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
    const mailResults = await Promise.allSettled(
      uniqueEmails.map((email) =>
        sendMarketingEmail({
          to: email,
          subject: input.subject,
          content: input.content,
          htmlContent: input.htmlContent,
        }),
      ),
    );
    sent = mailResults.filter((r) => r.status === "fulfilled").length;
    failed = mailResults.length - sent;
  }

  const created = await prisma.emailCampaign.create({
    data: {
      title: input.title,
      subject: input.subject,
      content: input.content,
      htmlContent: input.htmlContent,
      status: sendNow ? "sending" : "scheduled",
      priority: (input.priority as CampaignPriority) || "medium",
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

  const item: EmailCampaignItem = {
    id: created.id,
    title: input.title,
    subject: input.subject,
    content: input.content,
    status: sendNow ? "sending" : "scheduled",
    priority: (input.priority as CampaignPriority) || "medium",
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

export function listEmailTemplates(): EmailTemplateItem[] {
  return templatesStore;
}

export function listEmailTemplatesByCategory(category?: string): EmailTemplateItem[] {
  if (!category || category === "all") return templatesStore;
  const normalized = category.toLowerCase();
  return templatesStore.filter((t) => (t.category || "").toLowerCase() === normalized);
}

export function createEmailTemplate(input: {
  name: string;
  subject: string;
  content: string;
  htmlContent?: string;
  category?: string;
}): EmailTemplateItem & { isActive: boolean; createdAt: string; updatedAt: string } {
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

export function deleteEmailTemplate(id: string): boolean {
  const idx = templatesStore.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  templatesStore.splice(idx, 1);
  return true;
}

export async function listPushNotifications(status?: string): Promise<PushNotificationItem[]> {
  const where = !status || status === "all" ? {} : { status: status.toLowerCase() };
  const rows = await prisma.pushNotification.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.message,
    status: row.status as CampaignStatus,
    priority: row.priority as CampaignPriority,
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

export async function createPushNotification(input: {
  title: string;
  bodyText: string;
  priority?: string;
  targetAudiences?: string[];
  targetPlatforms?: string[];
  scheduledAt?: string;
  sendImmediately?: boolean;
}): Promise<PushNotificationItem> {
  const nowIso = new Date().toISOString();
  const sendNow = !!input.sendImmediately;
  const created = await prisma.pushNotification.create({
    data: {
      title: input.title,
      message: input.bodyText,
      status: sendNow ? "sending" : "scheduled",
      priority: (input.priority as CampaignPriority) || "medium",
      targetAudiences: Array.isArray(input.targetAudiences) ? input.targetAudiences : [],
      targetPlatforms: Array.isArray(input.targetPlatforms) ? input.targetPlatforms : ["ios", "android", "web"],
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      sentAt: sendNow ? new Date(nowIso) : null,
    },
  });
  const item: PushNotificationItem = {
    id: created.id,
    title: input.title,
    body: input.bodyText,
    status: sendNow ? "sending" : "scheduled",
    priority: (input.priority as CampaignPriority) || "medium",
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

export function listPushTemplates(): PushTemplateItem[] {
  return pushTemplatesStore;
}

export function listPushTemplatesByCategory(category?: string): PushTemplateItem[] {
  if (!category || category === "all") return pushTemplatesStore;
  const normalized = category.toLowerCase();
  return pushTemplatesStore.filter((t) => (t.category || "").toLowerCase() === normalized);
}

export function createPushTemplate(input: {
  name: string;
  title: string;
  message: string;
  imageUrl?: string;
  category?: string;
}): PushTemplateItem {
  const nowIso = new Date().toISOString();
  const item: PushTemplateItem = {
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

export function deletePushTemplate(id: string): boolean {
  const idx = pushTemplatesStore.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  pushTemplatesStore.splice(idx, 1);
  return true;
}

export interface MarketingTrafficSummary {
  totals: {
    emailCampaigns: number;
    pushNotifications: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  rates: {
    openRate: number;
    clickRate: number;
    deliveryRate: number;
  };
  channels: {
    email: { sent: number; delivered: number; opened: number; clicked: number };
    push: { sent: number; delivered: number; opened: number; clicked: number };
  };
}

export async function getMarketingTrafficSummaryAsync(): Promise<MarketingTrafficSummary> {
  const [emailCount, pushCount, emailAgg, pushAgg] = await Promise.all([
    prisma.emailCampaign.count(),
    prisma.pushNotification.count(),
    prisma.emailCampaign.aggregate({ _sum: { sent: true, delivered: true, opened: true, clicked: true } }),
    prisma.pushNotification.aggregate({ _sum: { sent: true, delivered: true, opened: true, clicked: true } }),
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

export interface SeoKeywordItem {
  id: string;
  keyword: string;
  intent: "brand" | "event" | "location" | "long-tail";
  volume: number;
  difficulty: number;
  priority: "low" | "medium" | "high";
  updatedAt: string;
}

export async function listSeoKeywords(): Promise<SeoKeywordItem[]> {
  const rows = await prisma.seoKeyword.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    intent: row.intent as SeoKeywordItem["intent"],
    volume: row.volume,
    difficulty: row.difficulty,
    priority: row.priority as SeoKeywordItem["priority"],
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createSeoKeyword(input: {
  keyword: string;
  intent?: SeoKeywordItem["intent"];
  volume?: number;
  difficulty?: number;
  priority?: SeoKeywordItem["priority"];
}): Promise<SeoKeywordItem> {
  const row = await prisma.seoKeyword.upsert({
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
    intent: row.intent as SeoKeywordItem["intent"],
    volume: row.volume,
    difficulty: row.difficulty,
    priority: row.priority as SeoKeywordItem["priority"],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function deleteSeoKeyword(id: string): Promise<boolean> {
  const found = await prisma.seoKeyword.findUnique({ where: { id } });
  if (!found) return false;
  await prisma.seoKeyword.delete({ where: { id } });
  return true;
}
