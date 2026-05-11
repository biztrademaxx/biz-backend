"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_SETTING_KEYS = void 0;
exports.readJsonSetting = readJsonSetting;
exports.writeJsonSetting = writeJsonSetting;
const prisma_1 = __importDefault(require("../../../config/prisma"));
exports.APP_SETTING_KEYS = {
    PLATFORM_MODULES: "platform_modules_v1",
    LANGUAGE_LOCALIZATION: "language_localization_v1",
    NOTIFICATION_SETTINGS: "notification_settings_v1",
    BACKUP_DASHBOARD: "backup_dashboard_v1",
};
async function readJsonSetting(key, fallback) {
    const row = await prisma_1.default.adminAppSetting.findUnique({ where: { key } });
    if (row?.value === undefined || row?.value === null)
        return fallback;
    return row.value;
}
async function writeJsonSetting(key, value) {
    await prisma_1.default.adminAppSetting.upsert({
        where: { key },
        create: { key, value: value },
        update: { value: value },
    });
}
