"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStates = listStates;
exports.createState = createState;
exports.updateState = updateState;
exports.deleteState = deleteState;
const prisma_1 = __importDefault(require("../../../config/prisma"));
async function backfillStatesFromCities() {
    const rows = await prisma_1.default.city.findMany({
        select: {
            state: true,
            countryId: true,
        },
    });
    for (const row of rows) {
        const name = String(row.state ?? "").trim();
        if (!name || !row.countryId)
            continue;
        await prisma_1.default.state.upsert({
            where: { name_countryId: { name, countryId: row.countryId } },
            update: {},
            create: {
                name,
                countryId: row.countryId,
                isActive: true,
                isPermitted: false,
            },
        });
    }
}
async function listStates(includeCounts, countryCode) {
    await backfillStatesFromCities();
    const where = {};
    if (countryCode) {
        const country = await prisma_1.default.country.findFirst({
            where: { code: { equals: countryCode.trim().toUpperCase(), mode: "insensitive" } },
            select: { id: true },
        });
        where.countryId = country?.id ?? "__none__";
    }
    const states = (await prisma_1.default.state.findMany({
        where,
        include: {
            country: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
    }));
    if (!includeCounts) {
        return states.map((s) => ({
            ...s,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            eventCount: 0,
            cityCount: 0,
        }));
    }
    const withCounts = await Promise.all(states.map(async (state) => {
        const cityCount = await prisma_1.default.city.count({
            where: {
                countryId: state.countryId,
                state: { equals: state.name, mode: "insensitive" },
            },
        });
        const eventCount = await prisma_1.default.event.count({
            where: {
                OR: [
                    { state: { equals: state.name, mode: "insensitive" } },
                    {
                        venue: {
                            venueState: { equals: state.name, mode: "insensitive" },
                        },
                    },
                ],
            },
        });
        return {
            id: state.id,
            name: state.name,
            countryId: state.countryId,
            isActive: state.isActive,
            isPermitted: state.isPermitted,
            createdAt: state.createdAt.toISOString(),
            updatedAt: state.updatedAt.toISOString(),
            eventCount,
            cityCount,
            country: state.country,
        };
    }));
    return withCounts;
}
async function createState(data) {
    const state = await prisma_1.default.state.create({
        data: {
            name: data.name.trim(),
            countryId: data.countryId,
            isActive: data.isActive !== false,
            isPermitted: !!data.isPermitted,
        },
        include: {
            country: { select: { id: true, name: true, code: true } },
        },
    });
    return {
        ...state,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
        eventCount: 0,
        cityCount: 0,
    };
}
async function updateState(id, data) {
    const state = await prisma_1.default.state.update({
        where: { id },
        data: {
            ...(data.name != null && { name: data.name.trim() }),
            ...(data.countryId != null && { countryId: data.countryId }),
            ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
            ...(typeof data.isPermitted === "boolean" && { isPermitted: data.isPermitted }),
        },
    });
    return state;
}
async function deleteState(id) {
    await prisma_1.default.state.delete({ where: { id } });
    return { deleted: true };
}
