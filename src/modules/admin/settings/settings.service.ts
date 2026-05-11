import { Prisma } from "@prisma/client";
import prisma from "../../../config/prisma";
import { languageSettingsSeed } from "./language-settings.seed";
import { MODULE_DEFINITIONS, DEFAULT_MODULE_STATUSES } from "./module-definitions.seed";
import { getDefaultBackupDashboardData } from "./backup-defaults.seed";
import {
  listPgDumpBackups,
  createPgDumpBackup,
  deletePgDumpBackup,
  restorePgDumpBackup,
  getBackupStorageRoot,
  sumDumpFilesBytes,
} from "./database-backup.engine";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  DEFAULT_NOTIFICATION_TYPES,
  DEFAULT_NOTIFICATION_SCHEDULES,
  DEFAULT_NOTIFICATION_GLOBAL_SETTINGS,
} from "./notification-defaults.seed";
import { APP_SETTING_KEYS, readJsonSetting, writeJsonSetting } from "./app-settings-json";

type ModuleUsageStats = { activeUsers: number; apiCalls: number; lastAccessed: string };

type PlatformModulesPersisted = Record<
  string,
  {
    status?: string;
    settings?: unknown[];
    usageStats?: ModuleUsageStats;
    lastUpdated?: string;
  }
>;

function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function stableUsageStats(moduleId: string): ModuleUsageStats {
  const h = stableHash(moduleId);
  const dayMs = 24 * 60 * 60 * 1000;
  const offsetDays = (h % 30) / 30;
  return {
    activeUsers: 100 + (h % 4900),
    apiCalls: 1000 + (h % 99000),
    lastAccessed: new Date(Date.now() - offsetDays * dayMs).toISOString(),
  };
}

function stableLastUpdated(moduleId: string): string {
  const h = stableHash(`${moduleId}_lu`);
  return new Date(Date.now() - (h % (30 * 24 * 60 * 60 * 1000))).toISOString();
}

export async function getModules() {
  const persisted = await readJsonSetting<PlatformModulesPersisted>(APP_SETTING_KEYS.PLATFORM_MODULES, {});
  const modules = MODULE_DEFINITIONS.map((def) => {
    const dflt = DEFAULT_MODULE_STATUSES[def.id] ?? { status: "inactive", settings: [] };
    const o = persisted[def.id] ?? {};
    const status = (o.status ?? dflt.status) as string;
    const settings = (o.settings ?? dflt.settings) as unknown[];
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

export async function patchModule(moduleId: string, body: { status?: string; settings?: unknown[] }) {
  const def = MODULE_DEFINITIONS.find((m) => m.id === moduleId);
  if (!def) {
    throw new Error("Unknown module");
  }
  const persisted = await readJsonSetting<PlatformModulesPersisted>(APP_SETTING_KEYS.PLATFORM_MODULES, {});
  const dflt = DEFAULT_MODULE_STATUSES[moduleId] ?? { status: "inactive", settings: [] };
  const prev = persisted[moduleId] ?? {};
  let status = (prev.status ?? dflt.status) as string;
  let settings = (prev.settings ?? dflt.settings) as unknown[];
  if (body.status !== undefined) status = body.status;
  if (body.settings !== undefined) settings = body.settings;

  persisted[moduleId] = {
    ...prev,
    status,
    settings,
    lastUpdated: new Date().toISOString(),
  };
  await writeJsonSetting(APP_SETTING_KEYS.PLATFORM_MODULES, persisted);
  return {
    id: moduleId,
    status,
    settings,
    updatedAt: new Date().toISOString(),
  };
}

/** Dashboard stats for the notification settings page (Message table + persisted UI config). */
export async function getNotifications() {
  const [totalSent, readCount] = await Promise.all([
    prisma.message.count(),
    prisma.message.count({ where: { isRead: true } }),
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
    channels: DEFAULT_NOTIFICATION_CHANNELS.map((c) => ({ ...c })),
    notificationTypes: DEFAULT_NOTIFICATION_TYPES.map((t) => ({ ...t, channels: { ...t.channels } })),
    schedules: DEFAULT_NOTIFICATION_SCHEDULES.map((s) => ({ ...s })),
    globalSettings: { ...DEFAULT_NOTIFICATION_GLOBAL_SETTINGS },
  };

  const stored = await readJsonSetting<Partial<typeof defaults>>(APP_SETTING_KEYS.NOTIFICATION_SETTINGS, {});
  return {
    stats,
    channels: stored.channels ?? defaults.channels,
    notificationTypes: stored.notificationTypes ?? defaults.notificationTypes,
    schedules: stored.schedules ?? defaults.schedules,
    globalSettings: { ...defaults.globalSettings, ...stored.globalSettings },
  };
}

export async function saveNotifications(body: Record<string, unknown>) {
  const cur = await readJsonSetting<Record<string, unknown>>(APP_SETTING_KEYS.NOTIFICATION_SETTINGS, {});
  const next: Record<string, unknown> = { ...cur };
  if (body.channels !== undefined) next.channels = body.channels;
  if (body.notificationTypes !== undefined) next.notificationTypes = body.notificationTypes;
  if (body.schedules !== undefined) next.schedules = body.schedules;
  if (body.globalSettings !== undefined) next.globalSettings = body.globalSettings;
  await writeJsonSetting(APP_SETTING_KEYS.NOTIFICATION_SETTINGS, next);
  return { ok: true as const };
}

export async function getSecurity() {
  return { settings: {} };
}

type LanguageSnapshot = {
  languages: unknown[];
  translations: unknown[];
  settings: Record<string, unknown>;
  stats: unknown[];
};

function cloneLanguageSeed(): LanguageSnapshot {
  const s = languageSettingsSeed as unknown as LanguageSnapshot;
  return {
    languages: JSON.parse(JSON.stringify(s.languages)),
    translations: JSON.parse(JSON.stringify(s.translations)),
    settings: { ...s.settings },
    stats: JSON.parse(JSON.stringify(s.stats)),
  };
}

async function loadLanguageSnapshot(): Promise<LanguageSnapshot> {
  const base = cloneLanguageSeed();
  const stored = await readJsonSetting<Partial<LanguageSnapshot> | null>(APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, null);
  if (!stored) return base;
  return {
    languages: stored.languages ?? base.languages,
    translations: stored.translations ?? base.translations,
    settings: { ...base.settings, ...stored.settings },
    stats: stored.stats ?? base.stats,
  };
}

export async function getLanguagePageData() {
  return loadLanguageSnapshot();
}

export async function patchLanguageLocaleSettings(body: Record<string, unknown>) {
  const cur = await loadLanguageSnapshot();
  cur.settings = { ...cur.settings, ...body };
  await writeJsonSetting(APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
  return { success: true as const, settings: cur.settings };
}

export async function patchLanguageRow(languageId: string, updates: Record<string, unknown>) {
  const cur = await loadLanguageSnapshot();
  cur.languages = cur.languages.map((l: any) => (l.id === languageId ? { ...l, ...updates } : l));
  await writeJsonSetting(APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
  return { success: true as const, id: languageId, updates };
}

export async function patchTranslationRow(translationId: string, translation: Record<string, unknown>) {
  const cur = await loadLanguageSnapshot();
  cur.translations = cur.translations.map((t: any) => (t.id === translationId ? { ...t, ...translation } : t));
  await writeJsonSetting(APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
  return { success: true as const, id: translationId, translation };
}

export async function deleteLanguageRow(languageId: string) {
  const cur = await loadLanguageSnapshot();
  cur.languages = cur.languages.filter((l: any) => l.id !== languageId);
  await writeJsonSetting(APP_SETTING_KEYS.LANGUAGE_LOCALIZATION, cur);
  return { success: true as const, deleted: languageId };
}

function formatBytesUi(n: number): string {
  if (n < 1024) return `${n} B`;
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

async function loadBackupUiExtras(): Promise<{ schedules: unknown[]; storageLocations: unknown[] }> {
  const def = getDefaultBackupDashboardData() as { schedules: unknown[]; storageLocations: unknown[] };
  const cur = await readJsonSetting<{ schedules?: unknown[]; storageLocations?: unknown[] }>(
    APP_SETTING_KEYS.BACKUP_DASHBOARD,
    {},
  );
  return {
    schedules: cur.schedules ?? def.schedules,
    storageLocations: cur.storageLocations ?? def.storageLocations,
  };
}

async function persistBackupUiExtras(updates: Partial<{ schedules: unknown[]; storageLocations: unknown[] }>) {
  const cur = await readJsonSetting<Record<string, unknown>>(APP_SETTING_KEYS.BACKUP_DASHBOARD, {});
  const base = getDefaultBackupDashboardData() as { schedules: unknown[]; storageLocations: unknown[] };
  const { backups: _legacyDummyBackups, ...rest } = cur;
  await writeJsonSetting(APP_SETTING_KEYS.BACKUP_DASHBOARD, {
    ...rest,
    schedules: updates.schedules ?? (cur.schedules as unknown[]) ?? base.schedules,
    storageLocations: updates.storageLocations ?? (cur.storageLocations as unknown[]) ?? base.storageLocations,
  });
}

export async function getBackup() {
  const [userCount, eventCount, tableRows] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    ),
  ]);
  const tableCount = Number(tableRows[0]?.c ?? 0);
  const backups = await listPgDumpBackups();
  const extras = await loadBackupUiExtras();
  const root = getBackupStorageRoot();
  const usedBytes = await sumDumpFilesBytes(root);

  const storageLocations = Array.isArray(extras.storageLocations) ? [...extras.storageLocations] : [];
  if (storageLocations.length > 0 && storageLocations[0] && typeof storageLocations[0] === "object") {
    storageLocations[0] = {
      ...(storageLocations[0] as Record<string, unknown>),
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

export async function postBackupRecord(body: Record<string, unknown>) {
  return createPgDumpBackup({ name: body.name as string | undefined });
}

export async function deleteBackupRecord(backupId: string) {
  await deletePgDumpBackup(backupId);
  return { success: true as const };
}

export async function postBackupRestore(backupId: string) {
  await restorePgDumpBackup(backupId);
  return {
    success: true as const,
    message:
      "Restore finished. If the app shows errors, restart the API and verify connections. Consider running ANALYZE after a major restore.",
  };
}

export async function postBackupSchedule(body: Record<string, unknown>) {
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
  await persistBackupUiExtras({ schedules: [...(extras.schedules as object[]), row] });
  return row;
}

export async function patchBackupSchedule(scheduleId: string, body: Record<string, unknown>) {
  const extras = await loadBackupUiExtras();
  const schedules = (extras.schedules as Record<string, unknown>[]).map((s) =>
    (s as { id: string }).id === scheduleId ? { ...s, ...body } : s,
  );
  await persistBackupUiExtras({ schedules });
  return { success: true as const, id: scheduleId, ...body };
}

export async function deleteBackupSchedule(scheduleId: string) {
  const extras = await loadBackupUiExtras();
  const schedules = (extras.schedules as { id: string }[]).filter((s) => s.id !== scheduleId);
  await persistBackupUiExtras({ schedules });
  return { success: true as const };
}
