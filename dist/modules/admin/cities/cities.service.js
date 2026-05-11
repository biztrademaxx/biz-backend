"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCities = listCities;
exports.getCityById = getCityById;
exports.createCity = createCity;
exports.updateCity = updateCity;
exports.deleteCity = deleteCity;
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function listCities(includeCounts) {
    const cities = await prisma_1.default.city.findMany({
        include: {
            country: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
    });
    if (!includeCounts) {
        return cities.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            eventCount: 0,
            country: c.country,
        }));
    }
    const withCounts = await Promise.all(cities.map(async (city) => {
        const eventCount = await prisma_1.default.event.count({
            where: {
                OR: [
                    { city: { contains: city.name, mode: "insensitive" } },
                    { venue: { venueCity: { contains: city.name, mode: "insensitive" } } },
                ],
            },
        });
        return {
            id: city.id,
            name: city.name,
            state: city.state,
            countryId: city.countryId,
            latitude: city.latitude,
            longitude: city.longitude,
            timezone: city.timezone,
            image: city.image,
            imagePublicId: city.imagePublicId,
            isActive: city.isActive,
            isPermitted: city.isPermitted,
            createdAt: city.createdAt.toISOString(),
            updatedAt: city.updatedAt.toISOString(),
            eventCount,
            country: city.country,
        };
    }));
    return withCounts;
}
async function getCityById(id) {
    const city = await prisma_1.default.city.findUnique({
        where: { id },
        include: { country: true },
    });
    if (!city)
        return null;
    const eventCount = await prisma_1.default.event.count({
        where: {
            OR: [
                { city: { contains: city.name, mode: "insensitive" } },
                { venue: { venueCity: { contains: city.name, mode: "insensitive" } } },
            ],
        },
    });
    return {
        ...city,
        createdAt: city.createdAt.toISOString(),
        updatedAt: city.updatedAt.toISOString(),
        eventCount,
    };
}
async function createCity(data) {
    const city = await prisma_1.default.city.create({
        data: {
            name: data.name.trim(),
            state: data.state.trim(),
            countryId: data.countryId,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            timezone: data.timezone ?? "UTC",
            image: data.image ?? "",
            imagePublicId: data.imagePublicId ?? null,
            isActive: data.isActive !== false,
            isPermitted: !!data.isPermitted,
        },
        include: { country: { select: { id: true, name: true, code: true } } },
    });
    return {
        ...city,
        createdAt: city.createdAt.toISOString(),
        updatedAt: city.updatedAt.toISOString(),
        eventCount: 0,
    };
}
async function updateCity(id, data) {
    const city = await prisma_1.default.city.update({
        where: { id },
        data: {
            ...(data.name != null && { name: data.name.trim() }),
            ...(data.state != null && { state: data.state.trim() }),
            ...(data.countryId != null && { countryId: data.countryId }),
            ...(data.latitude != null && { latitude: data.latitude }),
            ...(data.longitude != null && { longitude: data.longitude }),
            ...(data.timezone != null && { timezone: data.timezone }),
            ...(data.image != null && { image: data.image }),
            ...(data.imagePublicId != null && { imagePublicId: data.imagePublicId }),
            ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
            ...(typeof data.isPermitted === "boolean" && { isPermitted: data.isPermitted }),
        },
        include: { country: { select: { id: true, name: true, code: true } } },
    });
    return getCityById(city.id);
}
async function deleteCity(id) {
    await prisma_1.default.city.delete({ where: { id } });
    return { deleted: true };
}
