import type { Express } from "express";
import prisma from "../../config/prisma";
import { handleDocumentUpload } from "../../services/upload.service";

export type MarketingReportChannel = "SOCIAL_MEDIA" | "EMAIL" | "OTHER";

function parseReportDate(input: string): Date | null {
  const trimmed = String(input ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

export async function canViewPromotionMarketingReports(
  promotionId: string,
  viewerUserId?: string | null,
  viewerRole?: string | null,
  viewerDomain?: string | null,
): Promise<boolean> {
  if (!viewerUserId) return false;
  if (viewerDomain === "ADMIN" && (viewerRole === "SUPER_ADMIN" || viewerRole === "SUB_ADMIN")) {
    return true;
  }

  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: {
      organizerId: true,
      exhibitorId: true,
      status: true,
      event: { select: { organizerId: true } },
    },
  });
  if (!promotion) return false;

  const activeStatuses = ["ACTIVE", "APPROVED"];
  if (!activeStatuses.includes(promotion.status)) return false;

  if (promotion.organizerId === viewerUserId) return true;
  if (promotion.exhibitorId === viewerUserId) return true;
  if (promotion.event?.organizerId === viewerUserId) return true;
  return false;
}

export async function listPromotionMarketingReports(
  promotionId: string,
  year: number,
  month: number,
) {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, startDate: true, endDate: true, status: true },
  });
  if (!promotion) return { error: "NOT_FOUND" as const };

  const { start, end } = monthRange(year, month);
  const reports = await prisma.promotionMarketingReport.findMany({
    where: {
      promotionId,
      reportDate: { gte: start, lte: end },
    },
    orderBy: { reportDate: "asc" },
  });

  return {
    promotion: {
      id: promotion.id,
      startDate: promotion.startDate.toISOString(),
      endDate: promotion.endDate.toISOString(),
      status: promotion.status,
    },
    reports: reports.map(formatReport),
  };
}

function formatReport(report: {
  id: string;
  promotionId: string;
  reportDate: Date;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  notes: string | null;
  channel: string;
  createdAt: Date;
}) {
  return {
    id: report.id,
    promotionId: report.promotionId,
    reportDate: report.reportDate.toISOString().slice(0, 10),
    fileUrl: report.fileUrl,
    fileName: report.fileName,
    fileSize: report.fileSize,
    mimeType: report.mimeType,
    notes: report.notes,
    channel: report.channel,
    createdAt: report.createdAt.toISOString(),
  };
}

export async function uploadPromotionMarketingReport(
  promotionId: string,
  file: Express.Multer.File,
  reportDateRaw: string,
  uploadedById: string | null,
  notes?: string | null,
  channel: MarketingReportChannel = "SOCIAL_MEDIA",
) {
  const reportDate = parseReportDate(reportDateRaw);
  if (!reportDate) return { error: "INVALID_DATE" as const };

  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!promotion) return { error: "NOT_FOUND" as const };

  const promoStart = new Date(
    Date.UTC(
      promotion.startDate.getUTCFullYear(),
      promotion.startDate.getUTCMonth(),
      promotion.startDate.getUTCDate(),
    ),
  );
  const promoEnd = new Date(
    Date.UTC(
      promotion.endDate.getUTCFullYear(),
      promotion.endDate.getUTCMonth(),
      promotion.endDate.getUTCDate(),
    ),
  );
  if (reportDate < promoStart || reportDate > promoEnd) {
    return { error: "DATE_OUT_OF_RANGE" as const };
  }

  let upload;
  try {
    upload = await handleDocumentUpload(file);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UPLOAD_FAILED";
    return { error: msg as string };
  }

  const report = await prisma.promotionMarketingReport.upsert({
    where: {
      promotionId_reportDate: { promotionId, reportDate },
    },
    create: {
      promotionId,
      reportDate,
      fileUrl: upload.url,
      filePublicId: upload.publicId,
      fileName: file.originalname || "report",
      fileSize: file.size,
      mimeType: file.mimetype,
      notes: notes?.trim() || null,
      channel,
      uploadedById,
    },
    update: {
      fileUrl: upload.url,
      filePublicId: upload.publicId,
      fileName: file.originalname || "report",
      fileSize: file.size,
      mimeType: file.mimetype,
      notes: notes?.trim() || null,
      channel,
      uploadedById,
    },
  });

  return { report: formatReport(report) };
}

export async function deletePromotionMarketingReport(promotionId: string, reportId: string) {
  const existing = await prisma.promotionMarketingReport.findFirst({
    where: { id: reportId, promotionId },
  });
  if (!existing) return { error: "NOT_FOUND" as const };
  await prisma.promotionMarketingReport.delete({ where: { id: reportId } });
  return { success: true as const };
}
