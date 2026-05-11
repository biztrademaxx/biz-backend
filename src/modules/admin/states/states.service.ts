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

async function backfillStatesFromCities() {
  const rows = await prisma.city.findMany({
    select: {
      state: true,
      countryId: true,
    },
  });
  for (const row of rows) {
    const name = String(row.state ?? "").trim();
    if (!name || !row.countryId) continue;
    await (prisma as any).state.upsert({
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

export async function listStates(includeCounts: boolean, countryCode?: string) {
  await backfillStatesFromCities();
  const where: any = {};
  if (countryCode) {
    const country = await prisma.country.findFirst({
      where: { code: { equals: countryCode.trim().toUpperCase(), mode: "insensitive" } },
      select: { id: true },
    });
    where.countryId = country?.id ?? "__none__";
  }

  const states = (await (prisma as any).state.findMany({
    where,
    include: {
      country: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
  })) as StateWithCountry[];

  if (!includeCounts) {
    return states.map((s: StateWithCountry) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      eventCount: 0,
      cityCount: 0,
    }));
  }

  const withCounts = await Promise.all(
    states.map(async (state: StateWithCountry) => {
      const cityCount = await prisma.city.count({
        where: {
          countryId: state.countryId,
          state: { equals: state.name, mode: "insensitive" },
        },
      });
      const eventCount = await prisma.event.count({
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
    })
  );

  return withCounts;
}

export async function createState(data: {
  name: string;
  countryId: string;
  isActive?: boolean;
  isPermitted?: boolean;
}) {
  const state = await (prisma as any).state.create({
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
  const state = await (prisma as any).state.update({
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
  await (prisma as any).state.delete({ where: { id } });
  return { deleted: true };
}
