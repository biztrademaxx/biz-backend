import prisma from "../../../config/prisma";
import { cached, CACHE_KEYS, CACHE_TTL, invalidateEventCaches } from "../../../config/redis";
import { publicPublishedEventWhere } from "../../../utils/public-profile";

/** Active categories for public / organizer pickers (no counts). */
export async function listActiveEventCategoriesPublic() {
  return prisma.eventCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, icon: true, color: true },
  });
}

/** Active categories with counts of published public events (category name in Event.category[]). */
export async function listActiveEventCategoriesWithEventCounts() {
  return cached(
    CACHE_KEYS.eventsCategoriesBrowse(),
    CACHE_TTL.EVENTS_CATEGORIES_BROWSE,
    listActiveEventCategoriesWithEventCountsFromDb,
  );
}

async function listActiveEventCategoriesWithEventCountsFromDb() {
  const categories = await prisma.eventCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    categories.map(async (cat) => {
      const eventCount = await prisma.event.count({
        where: {
          AND: [publicPublishedEventWhere(), { category: { has: cat.name } }],
        },
      });
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color ?? "#3B82F6",
        eventCount,
      };
    }),
  );

  return rows.sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name));
}

export async function listEventCategories() {
  const categories = await prisma.eventCategory.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Compute event counts based on Event.category string[] matching category name
  const withCounts = await Promise.all(
    categories.map(async (cat) => {
      const eventCount = await prisma.event.count({
        where: {
          category: {
            has: cat.name,
          },
        },
      });
      return { ...cat, eventCount };
    })
  );

  return withCounts;
}

interface UpsertCategoryInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
}

export async function createEventCategory(input: UpsertCategoryInput) {
  const data: any = {
    name: input.name?.trim(),
    icon: input.icon ?? null,
    color: input.color ?? "#3B82F6",
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  };

  const created = await prisma.eventCategory.create({ data });
  await invalidateEventCaches();
  return created;
}

export async function updateEventCategory(id: string, input: UpsertCategoryInput) {
  const data: any = {};

  if (typeof input.name === "string") {
    data.name = input.name.trim();
  }
  if (input.icon !== undefined) {
    data.icon = input.icon;
  }
  if (input.color !== undefined) {
    data.color = input.color;
  }
  if (typeof input.isActive === "boolean") {
    data.isActive = input.isActive;
  }

  const updated = await prisma.eventCategory.update({
    where: { id },
    data,
  });
  await invalidateEventCaches();
  return updated;
}

export async function deleteEventCategory(id: string) {
  await prisma.eventCategory.delete({
    where: { id },
  });
  await invalidateEventCaches();
}
