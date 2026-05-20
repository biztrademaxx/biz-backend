"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const ctrl = __importStar(require("./settings.controller"));
const router = (0, express_1.Router)();
router.get("/modules", auth_middleware_1.requireAdmin, ctrl.getModules);
router.patch("/modules/:moduleId", auth_middleware_1.requireAdmin, ctrl.patchModule);
router.get("/notifications", auth_middleware_1.requireAdmin, ctrl.getNotifications);
router.patch("/notifications", auth_middleware_1.requireAdmin, ctrl.patchNotifications);
router.post("/notifications/test", auth_middleware_1.requireAdmin, ctrl.postNotificationTest);
router.get("/security", auth_middleware_1.requireAdmin, ctrl.getSecurity);
router.get("/language", auth_middleware_1.requireAdmin, ctrl.getLanguage);
router.patch("/language", auth_middleware_1.requireAdmin, ctrl.patchLanguageLocale);
// More specific routes before /language/:languageId
router.patch("/language/translation/:translationId", auth_middleware_1.requireAdmin, ctrl.patchTranslationRow);
router.patch("/language/:languageId", auth_middleware_1.requireAdmin, ctrl.patchLanguageRow);
router.delete("/language/:languageId", auth_middleware_1.requireAdmin, ctrl.deleteLanguageRow);
router.get("/backup", auth_middleware_1.requireAdmin, ctrl.getBackup);
router.post("/backup", auth_middleware_1.requireAdmin, ctrl.postBackupRecord);
router.post("/backup/schedules", auth_middleware_1.requireAdmin, ctrl.postBackupSchedule);
router.patch("/backup/schedules/:scheduleId", auth_middleware_1.requireAdmin, ctrl.patchBackupSchedule);
router.delete("/backup/schedules/:scheduleId", auth_middleware_1.requireAdmin, ctrl.deleteBackupSchedule);
router.post("/backup/:backupId/restore", auth_middleware_1.requireAdmin, ctrl.postBackupRestore);
router.delete("/backup/:backupId", auth_middleware_1.requireAdmin, ctrl.deleteBackupRecord);
exports.default = router;
