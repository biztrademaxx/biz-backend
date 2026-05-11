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
exports.getModules = getModules;
exports.getNotifications = getNotifications;
exports.patchNotifications = patchNotifications;
exports.postNotificationTest = postNotificationTest;
exports.getSecurity = getSecurity;
exports.getLanguage = getLanguage;
exports.patchLanguageLocale = patchLanguageLocale;
exports.patchLanguageRow = patchLanguageRow;
exports.patchTranslationRow = patchTranslationRow;
exports.deleteLanguageRow = deleteLanguageRow;
exports.patchModule = patchModule;
exports.postBackupRecord = postBackupRecord;
exports.deleteBackupRecord = deleteBackupRecord;
exports.postBackupRestore = postBackupRestore;
exports.postBackupSchedule = postBackupSchedule;
exports.patchBackupSchedule = patchBackupSchedule;
exports.deleteBackupSchedule = deleteBackupSchedule;
exports.getBackup = getBackup;
const admin_response_1 = require("../../../lib/admin-response");
const service = __importStar(require("./settings.service"));
async function getModules(req, res) {
    try {
        const data = await service.getModules();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get modules", e?.message);
    }
}
async function getNotifications(req, res) {
    try {
        const data = await service.getNotifications();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get notification settings", e?.message);
    }
}
async function patchNotifications(req, res) {
    try {
        await service.saveNotifications((req.body ?? {}));
        return res.json({ success: true });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to save notification settings", e?.message);
    }
}
async function postNotificationTest(req, res) {
    try {
        const channel = req.body?.channel ?? "unknown";
        return res.json({
            success: true,
            message: `Test notification sent via ${channel}`,
        });
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to send test notification", e?.message);
    }
}
async function getSecurity(req, res) {
    try {
        const data = await service.getSecurity();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get security settings", e?.message);
    }
}
async function getLanguage(_req, res) {
    try {
        const data = await service.getLanguagePageData();
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get language settings", e?.message);
    }
}
async function patchLanguageLocale(req, res) {
    try {
        const body = (req.body ?? {});
        const result = await service.patchLanguageLocaleSettings(body);
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to save language settings", e?.message);
    }
}
async function patchLanguageRow(req, res) {
    try {
        const { languageId } = req.params;
        const updates = (req.body ?? {});
        const result = await service.patchLanguageRow(languageId, updates);
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update language", e?.message);
    }
}
async function patchTranslationRow(req, res) {
    try {
        const { translationId } = req.params;
        const translation = (req.body ?? {});
        const result = await service.patchTranslationRow(translationId, translation);
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update translation", e?.message);
    }
}
async function deleteLanguageRow(req, res) {
    try {
        const { languageId } = req.params;
        const result = await service.deleteLanguageRow(languageId);
        return res.json(result);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete language", e?.message);
    }
}
async function patchModule(req, res) {
    try {
        const { moduleId } = req.params;
        const body = (req.body ?? {});
        const data = await service.patchModule(moduleId, body);
        return res.json({ success: true, data });
    }
    catch (e) {
        const msg = e?.message || "Failed to update module";
        const status = String(msg).includes("Unknown") ? 404 : 500;
        return (0, admin_response_1.sendError)(res, status, msg, e?.message);
    }
}
function truncateErr(msg, max = 3500) {
    if (!msg || msg.length <= max)
        return msg;
    return `${msg.slice(0, max)}…`;
}
async function postBackupRecord(req, res) {
    try {
        const row = await service.postBackupRecord((req.body ?? {}));
        return res.status(201).json(row);
    }
    catch (e) {
        const raw = e?.message || String(e);
        const isToolMissing = /ENOENT|spawn .*pg_dump|not recognized as an internal or external command/i.test(raw);
        const status = isToolMissing ? 503 : 500;
        const summary = isToolMissing
            ? "PostgreSQL client tools not found (pg_dump). Install PostgreSQL client tools and ensure pg_dump is on PATH, or set PG_DUMP_PATH to the full path to pg_dump.exe."
            : "Failed to create backup";
        return (0, admin_response_1.sendError)(res, status, summary, truncateErr(raw));
    }
}
async function deleteBackupRecord(req, res) {
    try {
        const { backupId } = req.params;
        const data = await service.deleteBackupRecord(backupId);
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete backup", e?.message);
    }
}
async function postBackupRestore(req, res) {
    try {
        const { backupId } = req.params;
        const data = await service.postBackupRestore(backupId);
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to restore backup", e?.message);
    }
}
async function postBackupSchedule(req, res) {
    try {
        const row = await service.postBackupSchedule((req.body ?? {}));
        return res.status(201).json(row);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to create schedule", e?.message);
    }
}
async function patchBackupSchedule(req, res) {
    try {
        const { scheduleId } = req.params;
        const data = await service.patchBackupSchedule(scheduleId, (req.body ?? {}));
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to update schedule", e?.message);
    }
}
async function deleteBackupSchedule(req, res) {
    try {
        const { scheduleId } = req.params;
        const data = await service.deleteBackupSchedule(scheduleId);
        return res.json(data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to delete schedule", e?.message);
    }
}
async function getBackup(req, res) {
    try {
        const data = await service.getBackup();
        return (0, admin_response_1.sendOne)(res, data);
    }
    catch (e) {
        return (0, admin_response_1.sendError)(res, 500, "Failed to get backup settings", e?.message);
    }
}
