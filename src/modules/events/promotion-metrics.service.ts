import prisma from "../../config/prisma";

const ACTIVE_PROMOTION_STATUSES = ["ACTIVE", "APPROVED"] as const;

export type PromotionMetricType = "impression" | "click";
export type PromotionConversionKind = "VISITOR" | "EXHIBITOR" | "SPEAKER";

function isAttendeeLeadType(type: string): boolean {
  const t = type.toLowerCase();
  return ["attendee", "visitor", "visit", "guest"].includes(t);
}

function isExhibitorLeadType(type: string): boolean {
  return type.toLowerCase().includes("exhibitor");
}

function isSpeakerLeadType(type: string): boolean {
  return type.toLowerCase().includes("speaker");
}

/** Active promotions within their scheduled window. */
export async function getActivePromotionsForEvent(eventId: string) {
  const now = new Date();
  return prisma.promotion.findMany({
    where: {
      eventId,
      status: { in: [...ACTIVE_PROMOTION_STATUSES] },
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function incrementPromotionCounters(
  promotionIds: string[],
  data: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    conversionVisitors?: number;
    conversionExhibitors?: number;
    conversionSpeakers?: number;
  },
) {
  if (promotionIds.length === 0) return;
  await prisma.$transaction(
    promotionIds.map((id) =>
      prisma.promotion.update({
        where: { id },
        data: {
          ...(data.impressions ? { impressions: { increment: data.impressions } } : {}),
          ...(data.clicks ? { clicks: { increment: data.clicks } } : {}),
          ...(data.conversions ? { conversions: { increment: data.conversions } } : {}),
          ...(data.conversionVisitors
            ? { conversionVisitors: { increment: data.conversionVisitors } }
            : {}),
          ...(data.conversionExhibitors
            ? { conversionExhibitors: { increment: data.conversionExhibitors } }
            : {}),
          ...(data.conversionSpeakers
            ? { conversionSpeakers: { increment: data.conversionSpeakers } }
            : {}),
        },
      }),
    ),
  );
}

/** Public: record impression or click (also bumps event.listingClicks on click). */
export async function trackPromotionMetric(
  eventId: string,
  type: PromotionMetricType,
  _source?: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) return { error: "NOT_FOUND" as const };

  const active = await getActivePromotionsForEvent(eventId);
  const promotionIds = active.map((p) => p.id);

  if (type === "click") {
    await prisma.event.update({
      where: { id: eventId },
      data: { listingClicks: { increment: 1 } },
    });
    await incrementPromotionCounters(promotionIds, { clicks: 1 });
  } else {
    await incrementPromotionCounters(promotionIds, { impressions: 1 });
  }

  return { success: true as const };
}

/** Called when a visitor registers, exhibits, etc. during an active promotion. */
export async function recordPromotionConversion(
  eventId: string,
  kind: PromotionConversionKind,
) {
  const active = await getActivePromotionsForEvent(eventId);
  if (active.length === 0) return;

  const promotionIds = active.map((p) => p.id);
  const patch: Parameters<typeof incrementPromotionCounters>[1] = {
    conversions: 1,
  };
  if (kind === "VISITOR") patch.conversionVisitors = 1;
  if (kind === "EXHIBITOR") patch.conversionExhibitors = 1;
  if (kind === "SPEAKER") patch.conversionSpeakers = 1;

  await incrementPromotionCounters(promotionIds, patch);
}

/** Map event lead type to promotion conversion kind. */
export function leadTypeToConversionKind(type: string): PromotionConversionKind | null {
  if (isAttendeeLeadType(type)) return "VISITOR";
  if (isExhibitorLeadType(type)) return "EXHIBITOR";
  if (isSpeakerLeadType(type)) return "SPEAKER";
  return null;
}

function formatPackageLabel(packageType: string): string {
  return packageType
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isAdminViewer(viewerDomain?: string | null, viewerRole?: string | null): boolean {
  return (
    viewerDomain === "ADMIN" &&
    (viewerRole === "SUPER_ADMIN" || viewerRole === "SUB_ADMIN")
  );
}

export async function canViewPromotionMetrics(
  eventId: string,
  viewerUserId?: string | null,
  viewerRole?: string | null,
  viewerDomain?: string | null,
): Promise<boolean> {
  if (!viewerUserId) return false;
  if (isAdminViewer(viewerDomain, viewerRole)) return true;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });
  return event?.organizerId === viewerUserId;
}

export function sanitizePromotionForViewer(
  promotion: {
    id: string;
    packageType: string;
    status: string;
    targetCategories: string[];
    amount: number;
    duration: number;
    startDate: Date;
    endDate: Date;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionVisitors: number;
    conversionExhibitors: number;
    conversionSpeakers: number;
    createdAt: Date;
  },
  canViewMetrics: boolean,
  isAdmin: boolean,
  eventListingClicks?: number,
) {
  const base = {
    id: promotion.id,
    packageType: promotion.packageType,
    packageName: formatPackageLabel(promotion.packageType),
    status: promotion.status,
    targetCategories: promotion.targetCategories,
    amount: promotion.amount,
    duration: promotion.duration,
    startDate: promotion.startDate.toISOString(),
    endDate: promotion.endDate.toISOString(),
    createdAt: promotion.createdAt.toISOString(),
  };

  const metricsVisible =
    canViewMetrics &&
    (isAdmin ||
      ACTIVE_PROMOTION_STATUSES.includes(
        promotion.status as (typeof ACTIVE_PROMOTION_STATUSES)[number],
      ));

  if (!metricsVisible) {
    return base;
  }

  return {
    ...base,
    impressions: promotion.impressions,
    clicks: promotion.clicks,
    conversions: promotion.conversions,
    conversionVisitors: promotion.conversionVisitors,
    conversionExhibitors: promotion.conversionExhibitors,
    conversionSpeakers: promotion.conversionSpeakers,
    eventListingClicks: eventListingClicks ?? 0,
  };
}
