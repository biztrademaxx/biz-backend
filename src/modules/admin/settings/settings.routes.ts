import { Router } from "express";
import { requireAdmin } from "../../../middleware/auth.middleware";
import * as ctrl from "./settings.controller";

const router = Router();

router.get("/modules", requireAdmin, ctrl.getModules);
router.patch("/modules/:moduleId", requireAdmin, ctrl.patchModule);

router.get("/notifications", requireAdmin, ctrl.getNotifications);
router.patch("/notifications", requireAdmin, ctrl.patchNotifications);
router.post("/notifications/test", requireAdmin, ctrl.postNotificationTest);

router.get("/security", requireAdmin, ctrl.getSecurity);

router.get("/language", requireAdmin, ctrl.getLanguage);
router.patch("/language", requireAdmin, ctrl.patchLanguageLocale);
// More specific routes before /language/:languageId
router.patch("/language/translation/:translationId", requireAdmin, ctrl.patchTranslationRow);
router.patch("/language/:languageId", requireAdmin, ctrl.patchLanguageRow);
router.delete("/language/:languageId", requireAdmin, ctrl.deleteLanguageRow);

router.get("/backup", requireAdmin, ctrl.getBackup);
router.post("/backup", requireAdmin, ctrl.postBackupRecord);
router.post("/backup/schedules", requireAdmin, ctrl.postBackupSchedule);
router.patch("/backup/schedules/:scheduleId", requireAdmin, ctrl.patchBackupSchedule);
router.delete("/backup/schedules/:scheduleId", requireAdmin, ctrl.deleteBackupSchedule);
router.post("/backup/:backupId/restore", requireAdmin, ctrl.postBackupRestore);
router.delete("/backup/:backupId", requireAdmin, ctrl.deleteBackupRecord);

export default router;
