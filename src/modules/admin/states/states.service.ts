import prisma from "../../../config/prisma";

type StateWithCountry = {
  id: string;
  name: string;
  countryId: string;
  isActive: boolean;
  isPermitted: boolean;
  createdAt: Date;
  updatedAt: Date;
  country: { id: string; name: string; code: string };
};

let backfillPromise: Promise<void> | null = null;

async function backfillStatesFromCitiesIfNeeded() {
  if (!backfillPromise) {
    backfillPromise = (async () => {
      const existing = await prisma.state.count();
      if (existing > 0) return;

      const rows = await prisma.city.findMany({
        select: { state: true, countryId: true },
      });

      const unique = new Map<string, { name: string; countryId: string }>();
      for (const row of rows) {
        const name = String(row.state ?? "").trim();
        if (!name || !row.countryId) continue;
        unique.set(`${name.toLowerCase()}::${row.countryId}`, { name, countryId: row.countryId });
      }

      if (unique.size === 0) return;

      await prisma.state.createMany({
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
    prisma.city.groupBy({
      by: ["countryId", "state"],
      _count: { _all: true },
    }),
    prisma.event.findMany({
      select: {
        state: true,
        venue: { select: { venueState: true } },
      },
    }),
  ]);

  const cityCountByKey = new Map<string, number>();
  for (const group of cityGroups) {
    const stateName = String(group.state ?? "").trim().toLowerCase();
    if (!stateName) continue;
    cityCountByKey.set(`${group.countryId}::${stateName}`, group._count._all ?? 0);
  }

  const eventCountByStateName = new Map<string, number>();
  for (const event of events) {
    const stateName = (event.state || event.venue?.venueState || "").trim().toLowerCase();
    if (!stateName) continue;
    eventCountByStateName.set(stateName, (eventCountByStateName.get(stateName) ?? 0) + 1);
  }

  return { cityCountByKey, eventCountByStateName };
}

export async function listStates(includeCounts: boolean, countryCode?: string) {
  await backfillStatesFromCitiesIfNeeded();

  const where: { countryId?: string } = {};
  if (countryCode) {
    const country = await prisma.country.findFirst({
      where: { code: { equals: countryCode.trim().toUpperCase(), mode: "insensitive" } },
      select: { id: true },
    });
    where.countryId = country?.id ?? "__none__";
  }

  const states = await prisma.state.findMany({
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

export async function createState(data: {
  name: string;
  countryId: string;
  isActive?: boolean;
  isPermitted?: boolean;
}) {
  const state = await prisma.state.create({
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

export async function updateState(
  id: string,
  data: Partial<{
    name: string;
    countryId: string;
    isActive: boolean;
    isPermitted: boolean;
  }>
) {
  const state = await prisma.state.update({
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

export async function deleteState(id: string) {
  await prisma.state.delete({ where: { id } });
  return { deleted: true };
}
