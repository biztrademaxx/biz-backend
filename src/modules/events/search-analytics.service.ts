/**
 * Search analytics — query demand + click feedback (Phase 4).
 */

import { randomUUID } from "crypto";
import prisma from "../../config/prisma";

export function normalizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

/** Fire-and-forget safe recorder for list/typeahead searches. */
export function recordSearchQuerySafe(input: {
  query: string;
  resultCount: number;
  source?: "events_list" | "navbar";
}): void {
  void recordSearchQuery(input).catch((err) => {
    console.error("recordSearchQuery:", err);
  });
}

export async function recordSearchQuery(input: {
  query: string;
  resultCount: number;
  source?: "events_list" | "navbar";
}) {
  const normalized = normalizeSearchQuery(input.query);
  if (normalized.length < 2) return null;

  const isZero = input.resultCount <= 0;
  const now = new Date();

  return prisma.searchQuery.upsert({
    where: { normalizedQuery: normalized },
    create: {
      id: randomUUID(),
      normalizedQuery: normalized,
      rawQuerySample: input.query.trim().slice(0, 200),
      resultCount: Math.max(0, input.resultCount),
      hitCount: 1,
      zeroResultCount: isZero ? 1 : 0,
      lastSeenAt: now,
    },
    update: {
      rawQuerySample: input.query.trim().slice(0, 200),
      resultCount: Math.max(0, input.resultCount),
      hitCount: { increment: 1 },
      ...(isZero ? { zeroResultCount: { increment: 1 } } : {}),
      lastSeenAt: now,
    },
  });
}

export async function recordSearchClick(input: {
  query?: string | null;
  eventId: string;
  position?: number | null;
  page?: number | null;
  userId?: string | null;
  sessionId?: string | null;
  listingSource?: "navbar" | "events_list";
}) {
  const eventId = String(input.eventId || "").trim();
  if (!eventId) {
    return { error: "INVALID_EVENT" as const };
  }

  const queryNormalized = input.query ? normalizeSearchQuery(input.query) : null;

  await prisma.searchClick.create({
    data: {
      id: randomUUID(),
      queryNormalized: queryNormalized && queryNormalized.length >= 2 ? queryNormalized : null,
      eventId,
      position: input.position ?? null,
      page: input.page ?? null,
      userId: input.userId ?? null,
      sessionId: input.sessionId?.slice(0, 64) ?? null,
      listingSource: input.listingSource === "navbar" ? "navbar" : "events_list",
    },
  });

  // Soft bump listing engagement used by popularity/trending
  await prisma.event
    .update({
      where: { id: eventId },
      data: { listingClicks: { increment: 1 } },
    })
    .catch(() => undefined);

  const { refreshEventSearchStats } = await import("./event-ranking.service");
  await refreshEventSearchStats(eventId).catch(() => undefined);

  return { success: true as const };
}

export async function getSearchAnalyticsSummary(options?: {
  limit?: number;
  days?: number;
}) {
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
  const days = Math.min(Math.max(options?.days ?? 14, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [topQueries, zeroResults, recentClicks, clickCount, queryCount] = await Promise.all([
    prisma.searchQuery.findMany({
      orderBy: [{ hitCount: "desc" }, { lastSeenAt: "desc" }],
      take: limit,
    }),
    prisma.searchQuery.findMany({
      where: { zeroResultCount: { gt: 0 } },
      orderBy: [{ zeroResultCount: "desc" }, { lastSeenAt: "desc" }],
      take: limit,
    }),
    prisma.searchClick.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.searchClick.count({ where: { createdAt: { gte: since } } }),
    prisma.searchQuery.count(),
  ]);

  return {
    days,
    totals: {
      uniqueQueries: queryCount,
      clicksInWindow: clickCount,
    },
    topQueries,
    zeroResults,
    recentClicks,
  };
}
