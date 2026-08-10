/**
 * Maintain Event.organizerPlanTier + EventSearchStats for ranked listing.
 */

import prisma from "../../config/prisma";
import { invalidateEventCaches } from "../../config/redis";
import {
  RANKING_VERSION,
  computeRankScore,
  freshnessScoreFromDates,
  popularityScoreFromCounts,
  subscriptionScoreFromTier,
  tierFromPlanSlug,
  trendingScoreFromWindows,
  type OrganizerPlanTier,
} from "./event-ranking";

async function resolveActiveOrganizerTier(
  organizerIds: string[],
): Promise<Map<string, OrganizerPlanTier>> {
  const unique = Array.from(new Set(organizerIds.filter(Boolean)));
  const map = new Map<string, OrganizerPlanTier>();
  for (const id of unique) map.set(id, "free");
  if (unique.length === 0) return map;

  const now = new Date();
  const subs = await prisma.userPlanSubscription.findMany({
    where: {
      userId: { in: unique },
      role: "ORGANIZER",
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { startedAt: "desc" },
    select: { userId: true, planSlug: true },
  });

  const seen = new Set<string>();
  for (const sub of subs) {
    if (seen.has(sub.userId)) continue;
    seen.add(sub.userId);
    map.set(sub.userId, tierFromPlanSlug(sub.planSlug));
  }
  return map;
}

/** Sync denormalized plan tier (+ rank scores) for all events of an organizer. */
export async function syncOrganizerPlanTierForUser(organizerId: string): Promise<number> {
  const tiers = await resolveActiveOrganizerTier([organizerId]);
  const tier = tiers.get(organizerId) ?? "free";
  const now = new Date();

  const result = await prisma.event.updateMany({
    where: { organizerId },
    data: {
      organizerPlanTier: tier,
      organizerPlanUpdatedAt: now,
    },
  });

  const events = await prisma.event.findMany({
    where: { organizerId },
    select: {
      id: true,
      createdAt: true,
      startDate: true,
      listingClicks: true,
      averageRating: true,
      _count: {
        select: {
          savedEvents: true,
          registrations: { where: { status: "CONFIRMED" } },
        },
      },
      searchStats: {
        select: { saves7d: true, regs7d: true, clicks7d: true },
      },
    },
  });

  for (const ev of events) {
    await upsertEventSearchStatsFromRow({
      eventId: ev.id,
      createdAt: ev.createdAt,
      startDate: ev.startDate,
      listingClicks: ev.listingClicks,
      averageRating: ev.averageRating,
      followersCount: ev._count.savedEvents,
      confirmedRegsCount: ev._count.registrations,
      saves7d: ev.searchStats?.saves7d ?? 0,
      regs7d: ev.searchStats?.regs7d ?? 0,
      clicks7d: ev.searchStats?.clicks7d ?? 0,
      organizerPlanTier: tier,
    });
  }

  await invalidateEventCaches();
  return result.count;
}

type StatsInput = {
  eventId: string;
  createdAt: Date;
  startDate: Date;
  listingClicks: number;
  averageRating: number;
  followersCount: number;
  confirmedRegsCount: number;
  saves7d?: number;
  regs7d?: number;
  clicks7d?: number;
  organizerPlanTier: string;
};

export async function upsertEventSearchStatsFromRow(input: StatsInput) {
  const subscriptionScore = subscriptionScoreFromTier(input.organizerPlanTier);
  const popularityScore = popularityScoreFromCounts({
    followersCount: input.followersCount,
    confirmedRegsCount: input.confirmedRegsCount,
    listingClicks: input.listingClicks,
    averageRating: input.averageRating,
  });
  const trendingScore = trendingScoreFromWindows({
    saves7d: input.saves7d ?? 0,
    regs7d: input.regs7d ?? 0,
    clicks7d: input.clicks7d ?? 0,
  });
  const freshnessScore = freshnessScoreFromDates({
    createdAt: input.createdAt,
    startDate: input.startDate,
  });
  const rankScore = computeRankScore({
    subscriptionScore,
    popularityScore,
    trendingScore,
    freshnessScore,
  });

  await prisma.eventSearchStats.upsert({
    where: { eventId: input.eventId },
    create: {
      eventId: input.eventId,
      followersCount: input.followersCount,
      confirmedRegsCount: input.confirmedRegsCount,
      listingClicks: input.listingClicks,
      averageRating: input.averageRating,
      saves7d: input.saves7d ?? 0,
      regs7d: input.regs7d ?? 0,
      clicks7d: input.clicks7d ?? 0,
      subscriptionScore,
      popularityScore,
      trendingScore,
      freshnessScore,
      rankScore,
      rankingVersion: RANKING_VERSION,
      statsUpdatedAt: new Date(),
    },
    update: {
      followersCount: input.followersCount,
      confirmedRegsCount: input.confirmedRegsCount,
      listingClicks: input.listingClicks,
      averageRating: input.averageRating,
      saves7d: input.saves7d ?? 0,
      regs7d: input.regs7d ?? 0,
      clicks7d: input.clicks7d ?? 0,
      subscriptionScore,
      popularityScore,
      trendingScore,
      freshnessScore,
      rankScore,
      rankingVersion: RANKING_VERSION,
      statsUpdatedAt: new Date(),
    },
  });
}

/** Refresh stats for a single event (save/unsave/click/registration hooks). */
export async function refreshEventSearchStats(eventId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      createdAt: true,
      startDate: true,
      listingClicks: true,
      averageRating: true,
      organizerPlanTier: true,
      _count: {
        select: {
          savedEvents: true,
          registrations: { where: { status: "CONFIRMED" } },
        },
      },
    },
  });
  if (!ev) return;

  const [saves7d, regs7d, analyticsAgg] = await Promise.all([
    prisma.savedEvent.count({ where: { eventId, savedAt: { gte: since } } }),
    prisma.eventRegistration.count({
      where: { eventId, status: "CONFIRMED", registeredAt: { gte: since } },
    }),
    prisma.eventAnalytics.aggregate({
      where: { eventId, date: { gte: since } },
      _sum: { pageViews: true },
    }),
  ]);

  await upsertEventSearchStatsFromRow({
    eventId: ev.id,
    createdAt: ev.createdAt,
    startDate: ev.startDate,
    listingClicks: ev.listingClicks,
    averageRating: ev.averageRating,
    followersCount: ev._count.savedEvents,
    confirmedRegsCount: ev._count.registrations,
    saves7d,
    regs7d,
    clicks7d: analyticsAgg._sum.pageViews ?? 0,
    organizerPlanTier: ev.organizerPlanTier || "free",
  });
}

/**
 * Recompute 7d trending windows for all EventSearchStats rows, then refresh rankScore.
 */
export async function refreshTrendingWindows7d() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  await prisma.$executeRaw`
    UPDATE event_search_stats s
    SET
      "saves7d" = COALESCE((
        SELECT COUNT(*)::int FROM saved_events se
        WHERE se."eventId" = s."eventId" AND se."savedAt" >= ${since}
      ), 0),
      "regs7d" = COALESCE((
        SELECT COUNT(*)::int FROM event_registrations er
        WHERE er."eventId" = s."eventId"
          AND er.status = 'CONFIRMED'
          AND er."registeredAt" >= ${since}
      ), 0),
      "clicks7d" = COALESCE((
        SELECT COALESCE(SUM(ea."pageViews"), 0)::int FROM event_analytics ea
        WHERE ea."eventId" = s."eventId" AND ea.date >= ${since}
      ), 0),
      "statsUpdatedAt" = NOW()
  `;

  // Recompute trendingScore + rankScore from updated windows (batched in JS for score formula consistency)
  const rows = await prisma.eventSearchStats.findMany({
    select: {
      eventId: true,
      subscriptionScore: true,
      popularityScore: true,
      freshnessScore: true,
      saves7d: true,
      regs7d: true,
      clicks7d: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    const trendingScore = trendingScoreFromWindows({
      saves7d: row.saves7d,
      regs7d: row.regs7d,
      clicks7d: row.clicks7d,
    });
    const rankScore = computeRankScore({
      subscriptionScore: row.subscriptionScore,
      popularityScore: row.popularityScore,
      trendingScore,
      freshnessScore: row.freshnessScore,
    });
    await prisma.eventSearchStats.update({
      where: { eventId: row.eventId },
      data: {
        trendingScore,
        rankScore,
        rankingVersion: RANKING_VERSION,
        statsUpdatedAt: new Date(),
      },
    });
    updated += 1;
  }

  await invalidateEventCaches();
  return { updated, since: since.toISOString() };
}

/**
 * Backfill organizerPlanTier + EventSearchStats for all events.
 * Safe to re-run. Returns counts updated.
 */
export async function backfillEventRankingFeatures(options?: { batchSize?: number }) {
  const batchSize = options?.batchSize ?? 200;
  let cursor: string | undefined;
  let eventsTouched = 0;
  let organizersSynced = 0;

  const organizerIds = await prisma.event.findMany({
    distinct: ["organizerId"],
    select: { organizerId: true },
  });
  const tierMap = await resolveActiveOrganizerTier(organizerIds.map((o) => o.organizerId));

  for (const { organizerId } of organizerIds) {
    const tier = tierMap.get(organizerId) ?? "free";
    await prisma.event.updateMany({
      where: { organizerId },
      data: {
        organizerPlanTier: tier,
        organizerPlanUpdatedAt: new Date(),
      },
    });
    organizersSynced += 1;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.event.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        createdAt: true,
        startDate: true,
        listingClicks: true,
        averageRating: true,
        organizerPlanTier: true,
        organizerId: true,
        _count: {
          select: {
            savedEvents: true,
            registrations: { where: { status: "CONFIRMED" } },
          },
        },
      },
    });
    if (batch.length === 0) break;

    for (const ev of batch) {
      const tier =
        (ev.organizerPlanTier as OrganizerPlanTier) ||
        tierMap.get(ev.organizerId) ||
        "free";
      await upsertEventSearchStatsFromRow({
        eventId: ev.id,
        createdAt: ev.createdAt,
        startDate: ev.startDate,
        listingClicks: ev.listingClicks,
        averageRating: ev.averageRating,
        followersCount: ev._count.savedEvents,
        confirmedRegsCount: ev._count.registrations,
        organizerPlanTier: tier,
      });
      eventsTouched += 1;
    }
    cursor = batch[batch.length - 1]?.id;
    if (batch.length < batchSize) break;
  }

  await invalidateEventCaches();
  const trending = await refreshTrendingWindows7d();
  return { eventsTouched, organizersSynced, rankingVersion: RANKING_VERSION, trending };
}
