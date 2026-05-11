import { Request, Response } from "express";
import { createImportJob, getImportJob } from "./event-import.service";
import prisma from "../../../config/prisma";

export async function postEventImportHandler(req: Request, res: Response) {
  try {
    const auth = req.auth!;
    if (auth.domain !== "ADMIN") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file?.buffer) {
      return res.status(400).json({ success: false, error: "No file uploaded (use field name: file)" });
    }

    const role =
      auth.role === "SUB_ADMIN" ? ("SUB_ADMIN" as const) : ("SUPER_ADMIN" as const);

    const { jobId } = await createImportJob({
      buffer: file.buffer,
      fileName: file.originalname || "import.xlsx",
      createdByAdminId: auth.sub,
      createdByAdminRole: role,
    });

    await prisma.adminLog.create({
      data: {
        adminId: auth.sub,
        adminType: role,
        action: "ADMIN_EVENT_BULK_IMPORT_STARTED",
        resource: "EVENT_IMPORT",
        resourceId: jobId,
        details: {
          fileName: file.originalname || "import.xlsx",
          size: file.size ?? 0,
        },
      },
    });

    return res.status(202).json({
      success: true,
      jobId,
      message: "Import started. Poll GET /api/admin/events/import/:jobId for progress.",
    });
  } catch (e: any) {
    return res.status(400).json({
      success: false,
      error: e?.message || "Import failed to start",
    });
  }
}

export async function getEventImportJobHandler(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ success: false, error: "jobId required" });
    }

    const job = await getImportJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    return res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        successCount: job.successCount,
        errorCount: job.errorCount,
        errors: job.errors,
        importedSummary: job.importedSummary,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Failed to load job",
    });
  }
}
