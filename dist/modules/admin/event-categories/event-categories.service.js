"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listActiveEventCategoriesPublic = listActiveEventCategoriesPublic;
exports.listActiveEventCategoriesWithEventCounts = listActiveEventCategoriesWithEventCounts;
exports.listEventCategories = listEventCategories;
exports.createEventCategory = createEventCategory;
exports.updateEventCategory = updateEventCategory;
exports.deleteEventCategory = deleteEventCategory;
const prisma_1 = __importDefault(require("../../../config/prisma"));
const redis_1 = require("../../../config/redis");
const public_profile_1 = require("../../../utils/public-profile");
/** Active categories for public / organizer pickers (no counts). */
async function listActiveEventCategoriesPublic() {
    return prisma_1.default.eventCategory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, icon: true, color: true },
    });
}
/** Active categories with counts of published public events (category name in Event.category[]). */
async function listActiveEventCategoriesWithEventCounts() {
    return (0, redis_1.cached)(redis_1.CACHE_KEYS.eventsCategoriesBrowse(), redis_1.CACHE_TTL.EVENTS_CATEGORIES_BROWSE, listActiveEventCategoriesWithEventCountsFromDb);
}
async function listActiveEventCategoriesWithEventCountsFromDb() {
    const categories = await prisma_1.default.eventCategory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
    });
    const rows = await Promise.all(categories.map(async (cat) => {
        const eventCount = await prisma_1.default.event.count({
            where: {
                AND: [(0, public_profile_1.publicPublishedEventWhere)(), { category: { has: cat.name } }],
            },
        });
        return {
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color ?? "#3B82F6",
            eventCount,
        };
    }));
    return rows.sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name));
}
async function listEventCategories() {
    const categories = await prisma_1.default.eventCategory.findMany({
        orderBy: { createdAt: "desc" },
    });
    // Compute event counts based on Event.category string[] matching category name
    const withCounts = await Promise.all(categories.map(async (cat) => {
        const eventCount = await prisma_1.default.event.count({
            where: {
                category: {
                    has: cat.name,
                },
            },
        });
        return { ...cat, eventCount };
    }));
    return withCounts;
}
async function createEventCategory(input) {
    const data = {
        name: input.name?.trim(),
        icon: input.icon ?? null,
        color: input.color ?? "#3B82F6",
        isActive: typeof input.isActive === "boolean" ? input.isActive : true,
    };
    const created = await prisma_1.default.eventCategory.create({ data });
    await (0, redis_1.invalidateEventCaches)();
    return created;
}
async function updateEventCategory(id, input) {
    const data = {};
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
    const updated = await prisma_1.default.eventCategory.update({
        where: { id },
        data,
    });
    await (0, redis_1.invalidateEventCaches)();
    return updated;
}
async function deleteEventCategory(id) {
    await prisma_1.default.eventCategory.delete({
        where: { id },
    });
    await (0, redis_1.invalidateEventCaches)();
}
