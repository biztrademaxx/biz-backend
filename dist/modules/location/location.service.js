"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicCountries = listPublicCountries;
exports.listPublicCities = listPublicCities;
const prisma_1 = __importDefault(require("../../config/prisma"));
/**
 * Run async work in small batches so we do not open dozens of Prisma queries at once
 * (Neon/serverless pools often cap concurrent connections — unbounded `Promise.all` exhausts them).
 */
async function mapInBatches(items, batchSize, fn) {
    const out = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const slice = items.slice(i, i + batchSize);
        const part = await Promise.all(slice.map((item) => fn(item)));
        out.push(...part);
    }
    return out;
}
/** Max concurrent `event.count` queries per public location handler (keep below pool size). */
const EVENT_COUNT_BATCH_SIZE = 3;
/** Venue-country match aligned with admin `countries.service` `listCountries` (includeCounts). */
async function countEventsForCountryVenue(country) {
    return prisma_1.default.event.count({
        where: {
            venue: {
                OR: [
                    { venueCountry: country.name },
                    { venueCountry: { contains: country.name, mode: "insensitive" } },
                    { venueCountry: { contains: country.code, mode: "insensitive" } },
                ],
            },
        },
    });
}
/** Public browse + forms: active countries with active cities, `isPermitted`, and event counts (no auth). */
async function listPublicCountries() {
    const rows = await prisma_1.default.country.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            code: true,
            flag: true,
            isPermitted: true,
            cities: {
                where: { isActive: true },
                orderBy: { name: "asc" },
                select: {
                    id: true,
                    name: true,
                    state: true,
                    image: true,
                },
            },
        },
    });
    const counts = await mapInBatches(rows, EVENT_COUNT_BATCH_SIZE, (c) => countEventsForCountryVenue(c));
    return rows.map((row, i) => ({
        ...row,
        eventCount: counts[i] ?? 0,
    }));
}
/** Same `venueCity` match as admin `cities.service` `listCities` (includeCounts). */
async function countEventsForCityVenue(cityName) {
    return prisma_1.default.event.count({
        where: {
            venue: { venueCity: { contains: cityName, mode: "insensitive" } },
        },
    });
}
/** Public browse + forms: active cities with country, `isPermitted`, and event counts (no auth). */
async function listPublicCities(countryId) {
    const where = { isActive: true };
    if (countryId)
        where.countryId = countryId;
    const rows = await prisma_1.default.city.findMany({
        where,
        orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
        include: {
            country: { select: { id: true, name: true, code: true } },
        },
    });
    const counts = await mapInBatches(rows, EVENT_COUNT_BATCH_SIZE, (c) => countEventsForCityVenue(c.name));
    return rows.map((row, i) => ({
        id: row.id,
        name: row.name,
        state: row.state,
        image: row.image,
        countryId: row.countryId,
        isPermitted: row.isPermitted,
        eventCount: counts[i] ?? 0,
        country: row.country,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));
}
