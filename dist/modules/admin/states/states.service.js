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
let backfillPromise = null;
async function backfillStatesFromCitiesIfNeeded() {
    if (!backfillPromise) {
        backfillPromise = (async () => {
            const existing = await prisma_1.default.state.count();
            if (existing > 0)
                return;
            const rows = await prisma_1.default.city.findMany({
                select: { state: true, countryId: true },
            });
            const unique = new Map();
            for (const row of rows) {
                const name = String(row.state ?? "").trim();
                if (!name || !row.countryId)
                    continue;
                unique.set(`${name.toLowerCase()}::${row.countryId}`, { name, countryId: row.countryId });
            }
            if (unique.size === 0)
                return;
            await prisma_1.default.state.createMany({
                data: Array.from(unique.values()).map((v) => ({
                    name: v.name,
                    countryId: v.countryId,
                    isActive: true,
                    isPermitted: false,
                })),
                skipDuplicates: true,
            });
        })().catch((err) => {
            backfillPromise = null;
            throw err;
        });
    }
    await backfillPromise;
}
async function buildStateCounts() {
    const [cityGroups, events] = await Promise.all([
        prisma_1.default.city.groupBy({
            by: ["countryId", "state"],
            _count: { _all: true },
        }),
        prisma_1.default.event.findMany({
            select: {
                state: true,
                venue: { select: { venueState: true } },
            },
        }),
    ]);
    const cityCountByKey = new Map();
    for (const group of cityGroups) {
        const stateName = String(group.state ?? "").trim().toLowerCase();
        if (!stateName)
            continue;
        cityCountByKey.set(`${group.countryId}::${stateName}`, group._count._all ?? 0);
    }
    const eventCountByStateName = new Map();
    for (const event of events) {
        const stateName = (event.state || event.venue?.venueState || "").trim().toLowerCase();
        if (!stateName)
            continue;
        eventCountByStateName.set(stateName, (eventCountByStateName.get(stateName) ?? 0) + 1);
    }
    return { cityCountByKey, eventCountByStateName };
}
async function listStates(includeCounts, countryCode) {
    await backfillStatesFromCitiesIfNeeded();
    const where = {};
    if (countryCode) {
        const country = await prisma_1.default.country.findFirst({
            where: { code: { equals: countryCode.trim().toUpperCase(), mode: "insensitive" } },
            select: { id: true },
        });
        where.countryId = country?.id ?? "__none__";
    }
    const states = await prisma_1.default.state.findMany({
        where,
        include: {
            country: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
    });
    if (!includeCounts) {
        return states.map((s) => ({
            ...s,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            eventCount: 0,
            cityCount: 0,
        }));
    }
    const { cityCountByKey, eventCountByStateName } = await buildStateCounts();
    return states.map((state) => {
        const stateKey = state.name.trim().toLowerCase();
        return {
            id: state.id,
            name: state.name,
            countryId: state.countryId,
            isActive: state.isActive,
            isPermitted: state.isPermitted,
            createdAt: state.createdAt.toISOString(),
            updatedAt: state.updatedAt.toISOString(),
            eventCount: eventCountByStateName.get(stateKey) ?? 0,
            cityCount: cityCountByKey.get(`${state.countryId}::${stateKey}`) ?? 0,
            country: state.country,
        };
    });
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
