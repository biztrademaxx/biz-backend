"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStateStats = listStateStats;
exports.listCountries = listCountries;
exports.getCountryById = getCountryById;
exports.createCountry = createCountry;
exports.updateCountry = updateCountry;
exports.deleteCountry = deleteCountry;
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function listStateStats(countryCode) {
    const countries = await prisma_1.default.country.findMany({
        select: { name: true, code: true },
    });
    const countryByCode = new Map(countries.map((c) => [c.code.toUpperCase(), c.name]));
    const selectedCountryName = countryCode ? countryByCode.get(countryCode.toUpperCase()) : null;
    const events = await prisma_1.default.event.findMany({
        select: {
            country: true,
            state: true,
            city: true,
            venue: {
                select: {
                    venueCountry: true,
                    venueState: true,
                    venueCity: true,
                },
            },
        },
    });
    const byState = new Map();
    for (const row of events) {
        const country = (row.country || row.venue?.venueCountry || "").trim();
        const state = (row.state || row.venue?.venueState || "").trim();
        const city = (row.city || row.venue?.venueCity || "").trim();
        if (!country || !state)
            continue;
        if (selectedCountryName && country.toLowerCase() !== selectedCountryName.toLowerCase())
            continue;
        const key = `${country.toLowerCase()}::${state.toLowerCase()}`;
        const current = byState.get(key) ?? { state, country, eventCount: 0, citySet: new Set() };
        current.eventCount += 1;
        if (city)
            current.citySet.add(city.toLowerCase());
        byState.set(key, current);
    }
    return Array.from(byState.values())
        .map((x) => ({
        state: x.state,
        country: x.country,
        eventCount: x.eventCount,
        cityCount: x.citySet.size,
    }))
        .sort((a, b) => b.eventCount - a.eventCount || a.state.localeCompare(b.state));
}
async function listCountries(includeCounts) {
    const countries = await prisma_1.default.country.findMany({
        include: {
            cities: { where: { isActive: true }, orderBy: { name: "asc" } },
            _count: { select: { cities: true } },
        },
        orderBy: { name: "asc" },
    });
    if (!includeCounts) {
        return countries.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            flag: c.flag,
            flagPublicId: c.flagPublicId,
            currency: c.currency,
            timezone: c.timezone,
            isActive: c.isActive,
            isPermitted: c.isPermitted,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            eventCount: 0,
            cityCount: c._count.cities,
            cities: c.cities.map((city) => ({
                ...city,
                createdAt: city.createdAt.toISOString(),
                updatedAt: city.updatedAt.toISOString(),
            })),
        }));
    }
    const withCounts = await Promise.all(countries.map(async (country) => {
        const cityCount = country._count.cities;
        let eventCount = 0;
        const venueCountryMatch = await prisma_1.default.event.count({
            where: {
                OR: [
                    { country: country.name },
                    { country: { contains: country.name, mode: "insensitive" } },
                    { country: { contains: country.code, mode: "insensitive" } },
                    {
                        venue: {
                            OR: [
                                { venueCountry: country.name },
                                { venueCountry: { contains: country.name, mode: "insensitive" } },
                                { venueCountry: { contains: country.code, mode: "insensitive" } },
                            ],
                        },
                    },
                ],
            },
        });
        eventCount += venueCountryMatch;
        return {
            id: country.id,
            name: country.name,
            code: country.code,
            flag: country.flag,
            flagPublicId: country.flagPublicId,
            currency: country.currency,
            timezone: country.timezone,
            isActive: country.isActive,
            isPermitted: country.isPermitted,
            createdAt: country.createdAt.toISOString(),
            updatedAt: country.updatedAt.toISOString(),
            eventCount,
            cityCount,
            cities: country.cities.map((city) => ({
                ...city,
                createdAt: city.createdAt.toISOString(),
                updatedAt: city.updatedAt.toISOString(),
            })),
        };
    }));
    return withCounts;
}
async function getCountryById(id) {
    const country = await prisma_1.default.country.findUnique({
        where: { id },
        include: {
            cities: { where: { isActive: true }, orderBy: { name: "asc" } },
            _count: { select: { cities: true } },
        },
    });
    if (!country)
        return null;
    let eventCount = 0;
    const venueCountryMatch = await prisma_1.default.event.count({
        where: {
            OR: [
                { country: country.name },
                { country: { contains: country.name, mode: "insensitive" } },
                { country: { contains: country.code, mode: "insensitive" } },
                {
                    venue: {
                        OR: [
                            { venueCountry: country.name },
                            { venueCountry: { contains: country.name, mode: "insensitive" } },
                            { venueCountry: { contains: country.code, mode: "insensitive" } },
                        ],
                    },
                },
            ],
        },
    });
    eventCount += venueCountryMatch;
    return {
        ...country,
        createdAt: country.createdAt.toISOString(),
        updatedAt: country.updatedAt.toISOString(),
        eventCount,
        cityCount: country._count.cities,
        cities: country.cities.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        })),
    };
}
async function createCountry(data) {
    const existing = await prisma_1.default.country.findFirst({
        where: {
            OR: [
                { name: { equals: data.name, mode: "insensitive" } },
                { code: { equals: data.code.toUpperCase(), mode: "insensitive" } },
            ],
        },
    });
    if (existing)
        throw new Error("Country with this name or code already exists");
    const country = await prisma_1.default.country.create({
        data: {
            name: data.name.trim(),
            code: data.code.toUpperCase().trim(),
            flag: data.flag ?? "",
            flagPublicId: data.flagPublicId ?? null,
            currency: data.currency ?? "USD",
            timezone: data.timezone ?? "UTC",
            isActive: data.isActive !== false,
            isPermitted: !!data.isPermitted,
        },
    });
    return {
        ...country,
        createdAt: country.createdAt.toISOString(),
        updatedAt: country.updatedAt.toISOString(),
        eventCount: 0,
        cityCount: 0,
    };
}
async function updateCountry(id, data) {
    const country = await prisma_1.default.country.update({
        where: { id },
        data: {
            ...(data.name != null && { name: data.name.trim() }),
            ...(data.code != null && { code: data.code.toUpperCase().trim() }),
            ...(data.flag != null && { flag: data.flag }),
            ...(data.flagPublicId != null && { flagPublicId: data.flagPublicId }),
            ...(data.currency != null && { currency: data.currency }),
            ...(data.timezone != null && { timezone: data.timezone }),
            ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
            ...(typeof data.isPermitted === "boolean" && { isPermitted: data.isPermitted }),
        },
    });
    return await getCountryById(country.id);
}
async function deleteCountry(id) {
    await prisma_1.default.country.delete({ where: { id } });
    return { deleted: true };
}
