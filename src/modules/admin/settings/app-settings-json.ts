import { Prisma } from "@prisma/client";
import prisma from "../../../config/prisma";

export const APP_SETTING_KEYS = {
  PLATFORM_MODULES: "platform_modules_v1",
  LANGUAGE_LOCALIZATION: "language_localization_v1",
  NOTIFICATION_SETTINGS: "notification_settings_v1",
  BACKUP_DASHBOARD: "backup_dashboard_v1",
} as const;

export async function readJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.adminAppSetting.findUnique({ where: { key } });
  if (row?.value === undefined || row?.value === null) return fallback;
  return row.value as T;
}

export async function writeJsonSetting(key: string, value: unknown): Promise<void> {
  await prisma.adminAppSetting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
}
