import { Request, Response } from "express";
import { sendOne, sendError } from "../../../lib/admin-response";
import * as service from "./settings.service";

export async function getModules(req: Request, res: Response) {
  try {
    const data = await service.getModules();
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get modules", e?.message);
  }
}

export async function getNotifications(req: Request, res: Response) {
  try {
    const data = await service.getNotifications();
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get notification settings", e?.message);
  }
}

export async function patchNotifications(req: Request, res: Response) {
  try {
    await service.saveNotifications((req.body ?? {}) as Record<string, unknown>);
    return res.json({ success: true });
  } catch (e: any) {
    return sendError(res, 500, "Failed to save notification settings", e?.message);
  }
}

export async function postNotificationTest(req: Request, res: Response) {
  try {
    const channel = (req.body as { channel?: string } | undefined)?.channel ?? "unknown";
    return res.json({
      success: true,
      message: `Test notification sent via ${channel}`,
    });
  } catch (e: any) {
    return sendError(res, 500, "Failed to send test notification", e?.message);
  }
}

export async function getSecurity(req: Request, res: Response) {
  try {
    const data = await service.getSecurity();
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get security settings", e?.message);
  }
}

export async function getLanguage(_req: Request, res: Response) {
  try {
    const data = await service.getLanguagePageData();
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get language settings", e?.message);
  }
}

export async function patchLanguageLocale(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await service.patchLanguageLocaleSettings(body);
    return res.json(result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to save language settings", e?.message);
  }
}

export async function patchLanguageRow(req: Request, res: Response) {
  try {
    const { languageId } = req.params;
    const updates = (req.body ?? {}) as Record<string, unknown>;
    const result = await service.patchLanguageRow(languageId, updates);
    return res.json(result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update language", e?.message);
  }
}

export async function patchTranslationRow(req: Request, res: Response) {
  try {
    const { translationId } = req.params;
    const translation = (req.body ?? {}) as Record<string, unknown>;
    const result = await service.patchTranslationRow(translationId, translation);
    return res.json(result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update translation", e?.message);
  }
}

export async function deleteLanguageRow(req: Request, res: Response) {
  try {
    const { languageId } = req.params;
    const result = await service.deleteLanguageRow(languageId);
    return res.json(result);
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete language", e?.message);
  }
}

export async function patchModule(req: Request, res: Response) {
  try {
    const { moduleId } = req.params;
    const body = (req.body ?? {}) as { status?: string; settings?: unknown[] };
    const data = await service.patchModule(moduleId, body);
    return res.json({ success: true, data });
  } catch (e: any) {
    const msg = e?.message || "Failed to update module";
    const status = String(msg).includes("Unknown") ? 404 : 500;
    return sendError(res, status, msg, e?.message);
  }
}

function truncateErr(msg: string, max = 3500): string {
  if (!msg || msg.length <= max) return msg;
  return `${msg.slice(0, max)}…`;
}

export async function postBackupRecord(req: Request, res: Response) {
  try {
    const row = await service.postBackupRecord((req.body ?? {}) as Record<string, unknown>);
    return res.status(201).json(row);
  } catch (e: any) {
    const raw = e?.message || String(e);
    const isToolMissing =
      /ENOENT|spawn .*pg_dump|not recognized as an internal or external command/i.test(raw);
    const status = isToolMissing ? 503 : 500;
    const summary = isToolMissing
      ? "PostgreSQL client tools not found (pg_dump). Install PostgreSQL client tools and ensure pg_dump is on PATH, or set PG_DUMP_PATH to the full path to pg_dump.exe."
      : "Failed to create backup";
    return sendError(res, status, summary, truncateErr(raw));
  }
}

export async function deleteBackupRecord(req: Request, res: Response) {
  try {
    const { backupId } = req.params;
    const data = await service.deleteBackupRecord(backupId);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete backup", e?.message);
  }
}

export async function postBackupRestore(req: Request, res: Response) {
  try {
    const { backupId } = req.params;
    const data = await service.postBackupRestore(backupId);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to restore backup", e?.message);
  }
}

export async function postBackupSchedule(req: Request, res: Response) {
  try {
    const row = await service.postBackupSchedule((req.body ?? {}) as Record<string, unknown>);
    return res.status(201).json(row);
  } catch (e: any) {
    return sendError(res, 500, "Failed to create schedule", e?.message);
  }
}

export async function patchBackupSchedule(req: Request, res: Response) {
  try {
    const { scheduleId } = req.params;
    const data = await service.patchBackupSchedule(scheduleId, (req.body ?? {}) as Record<string, unknown>);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to update schedule", e?.message);
  }
}

export async function deleteBackupSchedule(req: Request, res: Response) {
  try {
    const { scheduleId } = req.params;
    const data = await service.deleteBackupSchedule(scheduleId);
    return res.json(data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to delete schedule", e?.message);
  }
}

export async function getBackup(req: Request, res: Response) {
  try {
    const data = await service.getBackup();
    return sendOne(res, data);
  } catch (e: any) {
    return sendError(res, 500, "Failed to get backup settings", e?.message);
  }
}
