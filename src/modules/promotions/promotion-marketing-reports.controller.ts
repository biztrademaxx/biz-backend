import { Request, Response } from "express";
import {
  canViewPromotionMarketingReports,
  deletePromotionMarketingReport,
  listPromotionMarketingReports,
  uploadPromotionMarketingReport,
} from "./promotion-marketing-reports.service";

function parseYearMonth(query: Record<string, unknown>) {
  const now = new Date();
  const year = Number(query.year) || now.getUTCFullYear();
  const month = Number(query.month) || now.getUTCMonth() + 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export async function listPromotionMarketingReportsHandler(req: Request, res: Response) {
  try {
    const promotionId = req.params.promotionId!;
    const ym = parseYearMonth(req.query as Record<string, unknown>);
    if (!ym) return res.status(400).json({ error: "Invalid year or month" });

    const allowed = await canViewPromotionMarketingReports(
      promotionId,
      req.auth?.sub,
      req.auth?.role,
      req.auth?.domain,
    );
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const result = await listPromotionMarketingReports(promotionId, ym.year, ym.month);
    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({ error: "Promotion not found" });
    }
    return res.json(result);
  } catch (err: unknown) {
    console.error("List promotion marketing reports:", err);
    return res.status(500).json({ error: "Failed to list marketing reports" });
  }
}

export async function uploadPromotionMarketingReportHandler(req: Request, res: Response) {
  try {
    const promotionId = req.params.promotionId!;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "File is required (field: file)" });

    const reportDate = String(req.body?.reportDate ?? "");
    const notes = req.body?.notes != null ? String(req.body.notes) : null;
    const channel = String(req.body?.channel ?? "SOCIAL_MEDIA");

    const result = await uploadPromotionMarketingReport(
      promotionId,
      file,
      reportDate,
      req.auth?.sub ?? null,
      notes,
      channel === "EMAIL" || channel === "OTHER" ? channel : "SOCIAL_MEDIA",
    );

    if ("error" in result) {
      if (result.error === "NOT_FOUND") return res.status(404).json({ error: "Promotion not found" });
      if (result.error === "INVALID_DATE") return res.status(400).json({ error: "Invalid report date (use YYYY-MM-DD)" });
      if (result.error === "DATE_OUT_OF_RANGE") {
        return res.status(400).json({ error: "Report date must be within the promotion period" });
      }
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json(result);
  } catch (err: unknown) {
    console.error("Upload promotion marketing report:", err);
    return res.status(500).json({ error: "Failed to upload marketing report" });
  }
}

export async function deletePromotionMarketingReportHandler(req: Request, res: Response) {
  try {
    const promotionId = req.params.promotionId!;
    const reportId = req.params.reportId!;
    const result = await deletePromotionMarketingReport(promotionId, reportId);
    if ("error" in result && result.error === "NOT_FOUND") {
      return res.status(404).json({ error: "Report not found" });
    }
    return res.json({ success: true });
  } catch (err: unknown) {
    console.error("Delete promotion marketing report:", err);
    return res.status(500).json({ error: "Failed to delete marketing report" });
  }
}
