import prisma from "../../config/prisma";
import { publicPublishedEventWhere } from "../../utils/public-profile";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function ninetyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d;
}

export interface PromotionCategoryAudience {
  id: string;
  name: string;
  userCount: number;
  avgEngagement: number;
  eventCount: number;
  interestedUsers: number;
}

export async function getPromotionAudienceStats() {
  const since = ninetyDaysAgo();

  const [categories, usersWithInterests, totalUsers, subscriberCount] = await Promise.all([
    prisma.eventCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.user.findMany({
      where: { interests: { isEmpty: false } },
      select: { interests: true },
    }),
    prisma.user.count(),
    prisma.newsletterSubscriber
      .count({ where: { status: "ACTIVE" } })
      .catch(() => 0),
  ]);

  const categoryRows: PromotionCategoryAudience[] = await Promise.all(
    categories.map(async (cat) => {
      const target = norm(cat.name);
      const interestedUsers = usersWithInterests.filter((u) =>
        u.interests.some((i) => norm(i) === target),
      ).length;

      const eventCount = await prisma.event.count({
        where: {
          AND: [publicPublishedEventWhere(), { category: { has: cat.name } }],
        },
      });

      const recentLeads = await prisma.eventLead.count({
        where: {
          createdAt: { gte: since },
          event: { category: { has: cat.name } },
        },
      });

      const userCount = Math.max(
        interestedUsers,
        Math.round(eventCount * 90 + subscriberCount * 0.05),
        300,
      );

      const avgEngagement = Math.min(
        92,
        Math.max(
          48,
          Math.round(
            52 +
              Math.min(22, eventCount * 1.6) +
              Math.min(14, interestedUsers / 40) +
              Math.min(10, recentLeads / 8),
          ),
        ),
      );

      return {
        id: cat.id,
        name: cat.name,
        userCount,
        avgEngagement,
        eventCount,
        interestedUsers,
      };
    }),
  );

  const platformReach = Math.max(
    totalUsers + subscriberCount,
    categoryRows.reduce((sum, row) => sum + row.userCount, 0),
  );

  return {
    totalPlatformUsers: totalUsers,
    totalSubscribers: subscriberCount,
    platformReach,
    categories: categoryRows,
  };
}
