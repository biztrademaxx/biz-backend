import prisma from "../../../config/prisma";
import { sendNewsletterDigestEmail } from "../../../services/email.service";

const ACTIVE = "ACTIVE";
const UNSUBSCRIBED = "UNSUBSCRIBED";

export function normalizeNewsletterEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t || t.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

export async function subscribeNewsletter(email: string): Promise<{ ok: true; reactivated: boolean }> {
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) {
    if (existing.status === ACTIVE) {
      return { ok: true, reactivated: false };
    }
    await prisma.newsletterSubscriber.update({
      where: { email },
      data: { status: ACTIVE, unsubscribedAt: null, source: "footer" },
    });
    return { ok: true, reactivated: true };
  }
  await prisma.newsletterSubscriber.create({
    data: { email, status: ACTIVE, source: "footer" },
  });
  return { ok: true, reactivated: false };
}

export async function listNewsletterSubscribers(params: { page: number; limit: number }) {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  const skip = (page - 1) * limit;
  const where = { status: ACTIVE };

  const [rows, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
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
    prisma.newsletterSubscriber.count({ where }),
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

export async function listRecentEventsForNewsletter(take: number) {
  const n = Math.min(60, Math.max(1, take));
  const events = await prisma.event.findMany({
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

export type NewsletterSendEvent = {
  id: string;
  title: string;
  shortDescription: string | null;
  slug: string;
  startDate: string;
  endDate: string;
  city: string | null;
  state: string | null;
  country: string | null;
  venueName: string | null;
  thumbnailImage: string | null;
  bannerImage: string | null;
  isVirtual: boolean;
};

export async function sendNewsletterToActiveSubscribers(params: {
  eventIds: string[];
  subject: string;
  sentByUserId: string | null;
  sentByEmail: string | null;
}): Promise<{
  campaignId: string;
  recipientCount: number;
  sentSucceeded: number;
  sentFailed: number;
  events: NewsletterSendEvent[];
}> {
  const uniqueIds = [...new Set(params.eventIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw Object.assign(new Error("Select at least one event."), { status: 400 });
  }
  if (uniqueIds.length > 25) {
    throw Object.assign(new Error("You can select at most 25 events per send."), { status: 400 });
  }

  const eventsRaw = await prisma.event.findMany({
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
    throw Object.assign(
      new Error("One or more events are missing, not published, or not public."),
      { status: 400 },
    );
  }

  const order = new Map(uniqueIds.map((id, i) => [id, i]));
  eventsRaw.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const events: NewsletterSendEvent[] = eventsRaw.map((e) => ({
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

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: ACTIVE },
    select: { email: true },
  });

  const MAX_RECIPIENTS = 2000;
  if (subscribers.length === 0) {
    throw Object.assign(new Error("There are no active subscribers to email."), { status: 400 });
  }
  if (subscribers.length > MAX_RECIPIENTS) {
    throw Object.assign(
      new Error(`Too many active subscribers (${subscribers.length}). Contact support to raise the limit.`),
      { status: 400 },
    );
  }

  const campaign = await prisma.newsletterCampaign.create({
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
      await sendNewsletterDigestEmail({
        to: sub.email,
        subject: params.subject,
        events,
      });
      sentSucceeded += 1;
    } catch {
      sentFailed += 1;
    }
  }

  await prisma.newsletterCampaign.update({
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

export async function listRecentCampaigns(take: number) {
  const n = Math.min(50, Math.max(1, take));
  const rows = await prisma.newsletterCampaign.findMany({
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
