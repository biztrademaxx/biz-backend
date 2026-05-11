import { randomBytes } from "crypto";
import { execFileSync, spawn } from "child_process";
import { existsSync } from "fs";
import { mkdir, readdir, readFile, unlink, writeFile, stat } from "fs/promises";
import { join } from "path";

const DUMP_EXT = ".dump";
const META_EXT = ".meta.json";

/** Files on disk: `{id}.dump` + `{id}.meta.json` */

export type PgDumpBackupMeta = {
  name: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  format: "custom";
};

export function getBackupStorageRoot(): string {
  const fromEnv = process.env.BACKUP_STORAGE_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), "storage", "database-backups");
}

/**
 * `pg_dump` / `pg_restore` need a **session** connection, not Neon’s PgBouncer pooler.
 *
 * 1. If `BACKUP_DATABASE_URL` is set, it wins.
 * 2. Otherwise we derive from `DATABASE_URL`: strip `pgbouncer=true` and, for Neon pooler hosts,
 *    replace `-pooler.` with `.` (same pattern as the “direct” connection in the Neon console).
 * 3. If derivation fails for your project, paste the **direct** URL from Neon → Connection details.
 */
export function resolveBackupConnectionString(): string {
  const explicit = process.env.BACKUP_DATABASE_URL?.trim();
  if (explicit) return explicit;
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.searchParams.delete("pgbouncer");
    // Neon pooled hostname: …-pooler.<region>.aws.neon.tech → direct: ….<region>.aws.neon.tech
    if (u.hostname.includes("-pooler.")) {
      u.hostname = u.hostname.replace("-pooler.", ".");
    }
    return u.toString();
  } catch {
    return raw.replace(/[?&]pgbouncer=true(&|$)/g, "").replace(/\?&/g, "?");
  }
}

/**
 * On Windows, PostgreSQL is often installed under Program Files but not on PATH.
 * We probe standard `PostgreSQL\{version}\bin` locations before falling back to `pg_dump`.
 */
function findPostgresToolOnWindows(tool: "pg_dump" | "pg_restore"): string | null {
  const exe = tool === "pg_dump" ? "pg_dump.exe" : "pg_restore.exe";
  const versions = ["17", "18", "16", "15", "14", "13", "12"];
  const roots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ].filter(Boolean) as string[];

  for (const root of roots) {
    for (const ver of versions) {
      const p = join(root, "PostgreSQL", ver, "bin", exe);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/** Resolve `pg_dump` / `pg_restore` when on PATH (`where` / `command -v`) but not in standard install dirs. */
function resolvePgToolFromShellSearch(tool: "pg_dump" | "pg_restore"): string | null {
  const name = process.platform === "win32" ? `${tool}.exe` : tool;
  try {
    if (process.platform === "win32") {
      const whereExe = process.env.SystemRoot
        ? join(process.env.SystemRoot, "System32", "where.exe")
        : "where.exe";
      const out = execFileSync(whereExe, [name], {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const line = out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.toLowerCase().endsWith(name.toLowerCase()));
      if (line && existsSync(line)) return line;
    } else {
      const out = execFileSync("/bin/sh", ["-c", `command -v ${tool}`], { encoding: "utf8" })
        .trim()
        .split("\n")[0];
      if (out && existsSync(out)) return out;
    }
  } catch {
    /* not on PATH */
  }
  return null;
}

function pgDumpBinary(): string {
  const env = process.env.PG_DUMP_PATH?.trim();
  if (env) return env;
  if (process.platform === "win32") {
    const found = findPostgresToolOnWindows("pg_dump");
    if (found) return found;
    const pathHit = resolvePgToolFromShellSearch("pg_dump");
    if (pathHit) return pathHit;
  } else {
    const pathHit = resolvePgToolFromShellSearch("pg_dump");
    if (pathHit) return pathHit;
  }
  return "pg_dump";
}

function pgRestoreBinary(): string {
  const env = process.env.PG_RESTORE_PATH?.trim();
  if (env) return env;
  if (process.platform === "win32") {
    const found = findPostgresToolOnWindows("pg_restore");
    if (found) return found;
    const pathHit = resolvePgToolFromShellSearch("pg_restore");
    if (pathHit) return pathHit;
  } else {
    const pathHit = resolvePgToolFromShellSearch("pg_restore");
    if (pathHit) return pathHit;
  }
  return "pg_restore";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

function runProcess(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    // Windows: unqualified pg_dump on PATH often fails with spawn ENOENT unless shell is used.
    const winShell =
      process.platform === "win32" &&
      !/[\\/]/.test(command) &&
      (command === "pg_dump" || command === "pg_restore");
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      shell: winShell,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

const ID_RE = /^backup-\d+-[a-f0-9]{8}$/;

export function assertSafeBackupId(id: string): void {
  if (!ID_RE.test(id)) {
    throw new Error("Invalid backup id");
  }
}

async function ensureBackupDir(): Promise<string> {
  const root = getBackupStorageRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export async function sumDumpFilesBytes(root: string): Promise<number> {
  try {
    const names = await readdir(root);
    let sum = 0;
    for (const n of names) {
      if (!n.endsWith(DUMP_EXT)) continue;
      const st = await stat(join(root, n));
      sum += st.size;
    }
    return sum;
  } catch {
    return 0;
  }
}

export async function listPgDumpBackups(): Promise<
  Array<{
    id: string;
    name: string;
    type: "full";
    status: "completed" | "failed";
    size: string;
    sizeBytes: number;
    createdAt: string;
    completedAt: string;
    duration: string;
    storage: "local";
    encryption: boolean;
    collections: string[];
    retentionDays: number;
  }>
> {
  const root = getBackupStorageRoot();
  let names: string[] = [];
  try {
    names = await readdir(root);
  } catch {
    return [];
  }

  const dumps = names.filter((n) => n.endsWith(DUMP_EXT));
  const rows: Array<{
    id: string;
    name: string;
    type: "full";
    status: "completed" | "failed";
    size: string;
    sizeBytes: number;
    createdAt: string;
    completedAt: string;
    duration: string;
    storage: "local";
    encryption: boolean;
    collections: string[];
    retentionDays: number;
  }> = [];

  for (const file of dumps) {
    const id = file.slice(0, -DUMP_EXT.length);
    if (!ID_RE.test(id)) continue;
    const dumpPath = join(root, file);
    const metaPath = join(root, `${id}${META_EXT}`);
    let st: Awaited<ReturnType<typeof stat>>;
    try {
      st = await stat(dumpPath);
    } catch {
      continue;
    }
    let meta: PgDumpBackupMeta | null = null;
    try {
      const raw = await readFile(metaPath, "utf8");
      meta = JSON.parse(raw) as PgDumpBackupMeta;
    } catch {
      meta = null;
    }
    const sizeBytes = st.size;
    const completedAt = meta?.completedAt ?? st.mtime.toISOString();
    const createdAt = meta?.startedAt ?? st.birthtime.toISOString();
    rows.push({
      id,
      name: meta?.name || id,
      type: "full",
      status: "completed",
      size: formatBytes(sizeBytes),
      sizeBytes,
      createdAt,
      completedAt,
      duration: meta ? formatDuration(meta.durationMs) : "—",
      storage: "local",
      encryption: false,
      collections: [],
      retentionDays: 30,
    });
  }

  rows.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  return rows;
}

export async function createPgDumpBackup(body: { name?: string }): Promise<{
  id: string;
  name: string;
  type: string;
  status: string;
  size: string;
  sizeBytes: number;
  createdAt: string;
  completedAt: string;
  duration: string;
  storage: string;
  encryption: boolean;
  collections: string[];
  retentionDays: number;
}> {
  const conn = resolveBackupConnectionString();
  if (!conn) {
    throw new Error("DATABASE_URL or BACKUP_DATABASE_URL is not set");
  }

  const root = await ensureBackupDir();
  const id = `backup-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const dumpPath = join(root, `${id}${DUMP_EXT}`);
  const metaPath = join(root, `${id}${META_EXT}`);
  const label = typeof body.name === "string" && body.name.trim() ? body.name.trim() : `Backup ${id}`;

  const startedAt = new Date();
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        name: label,
        startedAt: startedAt.toISOString(),
        completedAt: "",
        durationMs: 0,
        format: "custom",
      } satisfies Partial<PgDumpBackupMeta>,
      null,
      2,
    ),
    "utf8",
  );

  const bin = pgDumpBinary();
  const args = ["-Fc", "-Z", "6", "-f", dumpPath, conn];

  const { stderr, code } = await runProcess(bin, args);
  if (code !== 0) {
    try {
      await unlink(dumpPath);
    } catch {
      /* ignore */
    }
    try {
      await unlink(metaPath);
    } catch {
      /* ignore */
    }
    const hint =
      stderr.includes("pg_dump") || stderr.includes("connection")
        ? " For Neon, set BACKUP_DATABASE_URL to the direct (non-pooler) connection string."
        : "";
    throw new Error(`pg_dump failed (exit ${code}): ${stderr || "no stderr"}${hint}`);
  }

  const st = await stat(dumpPath);
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();
  const meta: PgDumpBackupMeta = {
    name: label,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs,
    format: "custom",
  };
  await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

  return {
    id,
    name: label,
    type: "full",
    status: "completed",
    size: formatBytes(st.size),
    sizeBytes: st.size,
    createdAt: meta.startedAt,
    completedAt: meta.completedAt,
    duration: formatDuration(durationMs),
    storage: "local",
    encryption: false,
    collections: [],
    retentionDays: 30,
  };
}

export async function deletePgDumpBackup(backupId: string): Promise<void> {
  assertSafeBackupId(backupId);
  const root = getBackupStorageRoot();
  const dumpPath = join(root, `${backupId}${DUMP_EXT}`);
  const metaPath = join(root, `${backupId}${META_EXT}`);
  try {
    await unlink(dumpPath);
  } catch (e: any) {
    if (e?.code !== "ENOENT") throw e;
  }
  try {
    await unlink(metaPath);
  } catch {
    /* ignore */
  }
}

/**
 * Restores a custom-format dump into the database pointed to by BACKUP_DATABASE_URL or DATABASE_URL.
 * **Destructive**: drops existing objects. Enable only with `BACKUP_ALLOW_RESTORE=true`.
 */
export async function restorePgDumpBackup(backupId: string): Promise<void> {
  assertSafeBackupId(backupId);
  if (process.env.BACKUP_ALLOW_RESTORE !== "true") {
    throw new Error(
      "Database restore is disabled. Set environment variable BACKUP_ALLOW_RESTORE=true on the API server only when you intend to overwrite the database.",
    );
  }
  const conn = resolveBackupConnectionString();
  if (!conn) {
    throw new Error("DATABASE_URL or BACKUP_DATABASE_URL is not set");
  }
  const root = getBackupStorageRoot();
  const dumpPath = join(root, `${backupId}${DUMP_EXT}`);
  try {
    await stat(dumpPath);
  } catch {
    throw new Error("Backup file not found");
  }

  const bin = pgRestoreBinary();
  const args = ["--clean", "--if-exists", "--no-owner", "--no-acl", "-d", conn, dumpPath];
  const { stderr, code } = await runProcess(bin, args);
  if (code !== 0) {
    throw new Error(`pg_restore failed (exit ${code}): ${stderr || "no stderr"}`);
  }
}
