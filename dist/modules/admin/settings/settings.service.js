"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModules = getModules;
exports.patchModule = patchModule;
exports.getNotifications = getNotifications;
exports.saveNotifications = saveNotifications;
exports.getSecurity = getSecurity;
exports.getLanguagePageData = getLanguagePageData;
exports.patchLanguageLocaleSettings = patchLanguageLocaleSettings;
exports.patchLanguageRow = patchLanguageRow;
exports.patchTranslationRow = patchTranslationRow;
exports.deleteLanguageRow = deleteLanguageRow;
exports.getBackup = getBackup;
exports.postBackupRecord = postBackupRecord;
exports.deleteBackupRecord = deleteBackupRecord;
exports.postBackupRestore = postBackupRestore;
exports.postBackupSchedule = postBackupSchedule;
exports.patchBackupSchedule = patchBackupSchedule;
exports.deleteBackupSchedule = deleteBackupSchedule;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../../config/prisma"));
const language_settings_seed_1 = require("./language-settings.seed");
const module_definitions_seed_1 = require("./module-definitions.seed");
const backup_defaults_seed_1 = require("./backup-defaults.seed");
const database_backup_engine_1 = require("./database-backup.engine");
const notification_defaults_seed_1 = require("./notification-defaults.seed");
const app_settings_json_1 = require("./app-settings-json");
function stableHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}
function stableUsageStats(moduleId) {
    const h = stableHash(moduleId);
    const dayMs = 24 * 60 * 60 * 1000;
    const offsetDays = (h % 30) / 30;
    return {
        activeUsers: 100 + (h % 4900),
        apiCalls: 1000 + (h % 99000),
        lastAccessed: new Date(Date.now() - offsetDays * dayMs).toISOString(),
    };
}
function stableLastUpdated(moduleId) {
    const h = stableHash(`${moduleId}_lu`);
    return new Date(Date.now() - (h % (30 * 24 * 60 * 60 * 1000))).toISOString();
}
async function getModules() {
    const persisted = await (0, app_settings_json_1.readJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.PLATFORM_MODULES, {});
    const modules = module_definitions_seed_1.MODULE_DEFINITIONS.map((def) => {
        const dflt = module_definitions_seed_1.DEFAULT_MODULE_STATUSES[def.id] ?? { status: "inactive", settings: [] };
        const o = persisted[def.id] ?? {};
        const status = (o.status ?? dflt.status);
        const settings = (o.settings ?? dflt.settings);
        const usageStats = o.usageStats ?? stableUsageStats(def.id);
        const lastUpdated = o.lastUpdated ?? stableLastUpdated(def.id);
        return {
            ...def,
            status,
            settings,
            usageStats,
            lastUpdated,
        };
    });
    return { modules };
}
async function patchModule(moduleId, body) {
    const def = module_definitions_seed_1.MODULE_DEFINITIONS.find((m) => m.id === moduleId);
    if (!def) {
        throw new Error("Unknown module");
    }
    const persisted = await (0, app_settings_json_1.readJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.PLATFORM_MODULES, {});
    const dflt = module_definitions_seed_1.DEFAULT_MODULE_STATUSES[moduleId] ?? { status: "inactive", settings: [] };
    const prev = persisted[moduleId] ?? {};
    let status = (prev.status ?? dflt.status);
    let settings = (prev.settings ?? dflt.settings);
    if (body.status !== undefined)
        status = body.status;
    if (body.settings !== undefined)
        settings = body.settings;
    persisted[moduleId] = {
        ...prev,
        status,
        settings,
        lastUpdated: new Date().toISOString(),
    };
    await (0, app_settings_json_1.writeJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.PLATFORM_MODULES, persisted);
    return {
        id: moduleId,
        status,
        settings,
        updatedAt: new Date().toISOString(),
    };
}
/** Dashboard stats for the notification settings page (Message table + persisted UI config). */
async function getNotifications() {
    const [totalSent, readCount] = await Promise.all([
        prisma_1.default.message.count(),
        prisma_1.default.message.count({ where: { isRead: true } }),
    ]);
    const deliveryRate = totalSent > 0 ? 98.5 : 0;
    const openRate = totalSent > 0 ? Math.round((readCount / totalSent) * 100) : 0;
    const stats = {
        totalSent,
        deliveryRate,
        openRate,
        activeChannels: 3,
    };
    const defaults = {
        channels: notification_defaults_seed_1.DEFAULT_NOTIFICATION_CHANNELS.map((c) => ({ ...c })),
        notificationTypes: notification_defaults_seed_1.DEFAULT_NOTIFICATION_TYPES.map((t) => ({ ...t, channels: { ...t.channels } })),
        schedules: notification_defaults_seed_1.DEFAULT_NOTIFICATION_SCHEDULES.map((s) => ({ ...s })),
        globalSettings: { ...notification_defaults_seed_1.DEFAULT_NOTIFICATION_GLOBAL_SETTINGS },
    };
    const stored = await (0, app_settings_json_1.readJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.NOTIFICATION_SETTINGS, {});
    return {
        stats,
        channels: stored.channels ?? defaults.channels,
        notificationTypes: stored.notificationTypes ?? defaults.notificationTypes,
        schedules: stored.schedules ?? defaults.schedules,
        globalSettings: { ...defaults.globalSettings, ...stored.globalSettings },
    };
}
async function saveNotifications(body) {
    const cur = await (0, app_settings_json_1.readJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.NOTIFICATION_SETTINGS, {});
    const next = { ...cur };
    if (body.channels !== undefined)
        next.channels = body.channels;
    if (body.notificationTypes !== undefined)
        next.notificationTypes = body.notificationTypes;
    if (body.schedules !== undefined)
        next.schedules = body.schedules;
    if (body.globalSettings !== undefined)
        next.globalSettings = body.globalSettings;
    await (0, app_settings_json_1.writeJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.NOTIFICATION_SETTINGS, next);
    return { ok: true };
}
async function getSecurity() {
    return { settings: {} };
}
function cloneLanguageSeed() {
    const s = language_settings_seed_1.languageSettingsSeed;
    return {
        languages: JSON.parse(JSON.stringify(s.languages)),
        translations: JSON.parse(JSON.stringify(s.translations)),
        settings: { ...s.settings },
        stats: JSON.parse(JSON.stringify(s.stats)),
    };
}
async function loadLanguageSnapshot() {
    const base = cloneLanguageSeed();
    const stored = await (0, app_settings_json_1.readJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, null);
    if (!stored)
        return base;
    return {
        languages: stored.languages ?? base.languages,
        translations: stored.translations ?? base.translations,
        settings: { ...base.settings, ...stored.settings },
        stats: stored.stats ?? base.stats,
    };
}
async function getLanguagePageData() {
    return loadLanguageSnapshot();
}
async function patchLanguageLocaleSettings(body) {
    const cur = await loadLanguageSnapshot();
    cur.settings = { ...cur.settings, ...body };
    await (0, app_settings_json_1.writeJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
    return { success: true, settings: cur.settings };
}
async function patchLanguageRow(languageId, updates) {
    const cur = await loadLanguageSnapshot();
    cur.languages = cur.languages.map((l) => (l.id === languageId ? { ...l, ...updates } : l));
    await (0, app_settings_json_1.writeJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
    return { success: true, id: languageId, updates };
}
async function patchTranslationRow(translationId, translation) {
    const cur = await loadLanguageSnapshot();
    cur.translations = cur.translations.map((t) => (t.id === translationId ? { ...t, ...translation } : t));
    await (0, app_settings_json_1.writeJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
    return { success: true, id: translationId, translation };
}
async function deleteLanguageRow(languageId) {
    const cur = await loadLanguageSnapshot();
    cur.languages = cur.languages.filter((l) => l.id !== languageId);
    await (0, app_settings_json_1.writeJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
    return { success: true, deleted: languageId };
}
function formatBytesUi(n) {
    if (n < 1024)
        return `${n} B`;
    const mb = n / (1024 * 1024);
    if (mb < 1024)
        return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
}
async function loadBackupUiExtras() {
    const def = (0, backup_defaults_seed_1.getDefaultBackupDashboardData)();
    const cur = await (0, app_settings_json_1.readJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.BACKUP_DASHBOARD, {});
    return {
        schedules: cur.schedules ?? def.schedules,
        storageLocations: cur.storageLocations ?? def.storageLocations,
    };
}
async function persistBackupUiExtras(updates) {
    const cur = await (0, app_settings_json_1.readJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.BACKUP_DASHBOARD, {});
    const base = (0, backup_defaults_seed_1.getDefaultBackupDashboardData)();
    const { backups: _legacyDummyBackups, ...rest } = cur;
    await (0, app_settings_json_1.writeJsonSetting)(app_settings_json_1.APP_SETTING_KEYS.BACKUP_DASHBOARD, {
        ...rest,
        schedules: updates.schedules ?? cur.schedules ?? base.schedules,
        storageLocations: updates.storageLocations ?? cur.storageLocations ?? base.storageLocations,
    });
}
async function getBackup() {
    const [userCount, eventCount, tableRows] = await Promise.all([
        prisma_1.default.user.count(),
        prisma_1.default.event.count(),
        prisma_1.default.$queryRaw(client_1.Prisma.sql `SELECT COUNT(*)::bigint AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`),
    ]);
    const tableCount = Number(tableRows[0]?.c ?? 0);
    const backups = await (0, database_backup_engine_1.listPgDumpBackups)();
    const extras = await loadBackupUiExtras();
    const root = (0, database_backup_engine_1.getBackupStorageRoot)();
    const usedBytes = await (0, database_backup_engine_1.sumDumpFilesBytes)(root);
    const storageLocations = Array.isArray(extras.storageLocations) ? [...extras.storageLocations] : [];
    if (storageLocations.length > 0 && storageLocations[0] && typeof storageLocations[0] === "object") {
        storageLocations[0] = {
            ...storageLocations[0],
            path: root,
            name: "Local database dumps (pg_dump)",
            type: "local",
            usedSpace: formatBytesUi(usedBytes),
            totalSpace: "—",
            usagePercent: 0,
            enabled: true,
            isDefault: true,
        };
    }
    return {
        backups,
        schedules: extras.schedules,
        storageLocations,
        stats: {
            totalDocuments: userCount + eventCount,
            collections: tableCount,
        },
    };
}
async function postBackupRecord(body) {
    return (0, database_backup_engine_1.createPgDumpBackup)({ name: body.name });
}
async function deleteBackupRecord(backupId) {
    await (0, database_backup_engine_1.deletePgDumpBackup)(backupId);
    return { success: true };
}
async function postBackupRestore(backupId) {
    await (0, database_backup_engine_1.restorePgDumpBackup)(backupId);
    return {
        success: true,
        message: "Restore finished. If the app shows errors, restart the API and verify connections. Consider running ANALYZE after a major restore.",
    };
}
async function postBackupSchedule(body) {
    const extras = await loadBackupUiExtras();
    const id = `schedule_${Date.now()}`;
    const row = {
        id,
        name: body.name,
        type: body.type,
        frequency: body.frequency,
        time: body.time,
        dayOfWeek: body.dayOfWeek,
        dayOfMonth: body.dayOfMonth,
        enabled: true,
        lastRun: new Date().toISOString(),
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        retention: body.retention,
        storage: body.storage,
    };
    await persistBackupUiExtras({ schedules: [...extras.schedules, row] });
    return row;
}
async function patchBackupSchedule(scheduleId, body) {
    const extras = await loadBackupUiExtras();
    const schedules = extras.schedules.map((s) => s.id === scheduleId ? { ...s, ...body } : s);
    await persistBackupUiExtras({ schedules });
    return { success: true, id: scheduleId, ...body };
}
async function deleteBackupSchedule(scheduleId) {
    const extras = await loadBackupUiExtras();
    const schedules = extras.schedules.filter((s) => s.id !== scheduleId);
    await persistBackupUiExtras({ schedules });
    return { success: true };
}
