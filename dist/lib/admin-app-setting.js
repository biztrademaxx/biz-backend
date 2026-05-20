"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppSettingJson = getAppSettingJson;
exports.setAppSettingJson = setAppSettingJson;
exports.mergeAppSettingJson = mergeAppSettingJson;
const prisma_1 = __importDefault(require("../config/prisma"));
async function getAppSettingJson(key, fallback) {
    const row = await prisma_1.default.adminAppSetting.findUnique({ where: { key } });
    if (!row?.value)
        return fallback;
    try {
        return row.value;
    }
    catch {
        return fallback;
    }
}
async function setAppSettingJson(key, value) {
    await prisma_1.default.adminAppSetting.upsert({
        where: { key },
        create: { key, value: value },
        update: { value: value },
    });
}
async function mergeAppSettingJson(key, patch, fallback) {
    const current = await getAppSettingJson(key, fallback);
    const next = { ...current, ...patch };
    await setAppSettingJson(key, next);
    return next;
}
