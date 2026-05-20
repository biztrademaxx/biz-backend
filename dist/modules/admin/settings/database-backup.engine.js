"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBackupStorageRoot = getBackupStorageRoot;
exports.resolveBackupConnectionString = resolveBackupConnectionString;
exports.assertSafeBackupId = assertSafeBackupId;
exports.sumDumpFilesBytes = sumDumpFilesBytes;
exports.listPgDumpBackups = listPgDumpBackups;
exports.createPgDumpBackup = createPgDumpBackup;
exports.deletePgDumpBackup = deletePgDumpBackup;
exports.restorePgDumpBackup = restorePgDumpBackup;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const DUMP_EXT = ".dump";
const META_EXT = ".meta.json";
function getBackupStorageRoot() {
    const fromEnv = process.env.BACKUP_STORAGE_DIR?.trim();
    if (fromEnv)
        return fromEnv;
    return (0, path_1.join)(process.cwd(), "storage", "database-backups");
}
/**
 * `pg_dump` / `pg_restore` need a **session** connection, not Neon’s PgBouncer pooler.
 *
 * 1. If `BACKUP_DATABASE_URL` is set, it wins.
 * 2. Otherwise we derive from `DATABASE_URL`: strip `pgbouncer=true` and, for Neon pooler hosts,
 *    replace `-pooler.` with `.` (same pattern as the “direct” connection in the Neon console).
 * 3. If derivation fails for your project, paste the **direct** URL from Neon → Connection details.
 */
function resolveBackupConnectionString() {
    const explicit = process.env.BACKUP_DATABASE_URL?.trim();
    if (explicit)
        return explicit;
    const raw = process.env.DATABASE_URL?.trim() ?? "";
    if (!raw)
        return "";
    try {
        const u = new URL(raw);
        u.searchParams.delete("pgbouncer");
        // Neon pooled hostname: …-pooler.<region>.aws.neon.tech → direct: ….<region>.aws.neon.tech
        if (u.hostname.includes("-pooler.")) {
            u.hostname = u.hostname.replace("-pooler.", ".");
        }
        return u.toString();
    }
    catch {
        return raw.replace(/[?&]pgbouncer=true(&|$)/g, "").replace(/\?&/g, "?");
    }
}
/**
 * On Windows, PostgreSQL is often installed under Program Files but not on PATH.
 * We probe standard `PostgreSQL\{version}\bin` locations before falling back to `pg_dump`.
 */
function findPostgresToolOnWindows(tool) {
    const exe = tool === "pg_dump" ? "pg_dump.exe" : "pg_restore.exe";
    const versions = ["17", "18", "16", "15", "14", "13", "12"];
    const roots = [
        process.env.ProgramFiles,
        process.env["ProgramFiles(x86)"],
        "C:\\Program Files",
        "C:\\Program Files (x86)",
    ].filter(Boolean);
    for (const root of roots) {
        for (const ver of versions) {
            const p = (0, path_1.join)(root, "PostgreSQL", ver, "bin", exe);
            if ((0, fs_1.existsSync)(p))
                return p;
        }
    }
    return null;
}
/** Resolve `pg_dump` / `pg_restore` when on PATH (`where` / `command -v`) but not in standard install dirs. */
function resolvePgToolFromShellSearch(tool) {
    const name = process.platform === "win32" ? `${tool}.exe` : tool;
    try {
        if (process.platform === "win32") {
            const whereExe = process.env.SystemRoot
                ? (0, path_1.join)(process.env.SystemRoot, "System32", "where.exe")
                : "where.exe";
            const out = (0, child_process_1.execFileSync)(whereExe, [name], {
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "pipe"],
            });
            const line = out
                .split(/\r?\n/)
                .map((l) => l.trim())
                .find((l) => l.toLowerCase().endsWith(name.toLowerCase()));
            if (line && (0, fs_1.existsSync)(line))
                return line;
        }
        else {
            const out = (0, child_process_1.execFileSync)("/bin/sh", ["-c", `command -v ${tool}`], { encoding: "utf8" })
                .trim()
                .split("\n")[0];
            if (out && (0, fs_1.existsSync)(out))
                return out;
        }
    }
    catch {
        /* not on PATH */
    }
    return null;
}
function pgDumpBinary() {
    const env = process.env.PG_DUMP_PATH?.trim();
    if (env)
        return env;
    if (process.platform === "win32") {
        const found = findPostgresToolOnWindows("pg_dump");
        if (found)
            return found;
        const pathHit = resolvePgToolFromShellSearch("pg_dump");
        if (pathHit)
            return pathHit;
    }
    else {
        const pathHit = resolvePgToolFromShellSearch("pg_dump");
        if (pathHit)
            return pathHit;
    }
    return "pg_dump";
}
function pgRestoreBinary() {
    const env = process.env.PG_RESTORE_PATH?.trim();
    if (env)
        return env;
    if (process.platform === "win32") {
        const found = findPostgresToolOnWindows("pg_restore");
        if (found)
            return found;
        const pathHit = resolvePgToolFromShellSearch("pg_restore");
        if (pathHit)
            return pathHit;
    }
    else {
        const pathHit = resolvePgToolFromShellSearch("pg_restore");
        if (pathHit)
            return pathHit;
    }
    return "pg_restore";
}
function formatBytes(n) {
    if (n < 1024)
        return `${n} B`;
    const mb = n / (1024 * 1024);
    if (mb < 1024)
        return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${Math.round(ms)} ms`;
    if (ms < 60000)
        return `${Math.round(ms / 1000)} s`;
    return `${Math.round(ms / 60000)} min`;
}
function runProcess(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        // Windows: unqualified pg_dump on PATH often fails with spawn ENOENT unless shell is used.
        const winShell = process.platform === "win32" &&
            !/[\\/]/.test(command) &&
            (command === "pg_dump" || command === "pg_restore");
        const child = (0, child_process_1.spawn)(command, args, {
            env: { ...process.env, ...options.env },
            shell: winShell,
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d) => {
            stdout += d.toString();
        });
        child.stderr?.on("data", (d) => {
            stderr += d.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
            resolve({ stdout, stderr, code });
        });
    });
}
const ID_RE = /^backup-\d+-[a-f0-9]{8}$/;
function assertSafeBackupId(id) {
    if (!ID_RE.test(id)) {
        throw new Error("Invalid backup id");
    }
}
async function ensureBackupDir() {
    const root = getBackupStorageRoot();
    await (0, promises_1.mkdir)(root, { recursive: true });
    return root;
}
async function sumDumpFilesBytes(root) {
    try {
        const names = await (0, promises_1.readdir)(root);
        let sum = 0;
        for (const n of names) {
            if (!n.endsWith(DUMP_EXT))
                continue;
            const st = await (0, promises_1.stat)((0, path_1.join)(root, n));
            sum += st.size;
        }
        return sum;
    }
    catch {
        return 0;
    }
}
async function listPgDumpBackups() {
    const root = getBackupStorageRoot();
    let names = [];
    try {
        names = await (0, promises_1.readdir)(root);
    }
    catch {
        return [];
    }
    const dumps = names.filter((n) => n.endsWith(DUMP_EXT));
    const rows = [];
    for (const file of dumps) {
        const id = file.slice(0, -DUMP_EXT.length);
        if (!ID_RE.test(id))
            continue;
        const dumpPath = (0, path_1.join)(root, file);
        const metaPath = (0, path_1.join)(root, `${id}${META_EXT}`);
        let st;
        try {
            st = await (0, promises_1.stat)(dumpPath);
        }
        catch {
            continue;
        }
        let meta = null;
        try {
            const raw = await (0, promises_1.readFile)(metaPath, "utf8");
            meta = JSON.parse(raw);
        }
        catch {
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
async function createPgDumpBackup(body) {
    const conn = resolveBackupConnectionString();
    if (!conn) {
        throw new Error("DATABASE_URL or BACKUP_DATABASE_URL is not set");
    }
    const root = await ensureBackupDir();
    const id = `backup-${Date.now()}-${(0, crypto_1.randomBytes)(4).toString("hex")}`;
    const dumpPath = (0, path_1.join)(root, `${id}${DUMP_EXT}`);
    const metaPath = (0, path_1.join)(root, `${id}${META_EXT}`);
    const label = typeof body.name === "string" && body.name.trim() ? body.name.trim() : `Backup ${id}`;
    const startedAt = new Date();
    await (0, promises_1.writeFile)(metaPath, JSON.stringify({
        name: label,
        startedAt: startedAt.toISOString(),
        completedAt: "",
        durationMs: 0,
        format: "custom",
    }, null, 2), "utf8");
    const bin = pgDumpBinary();
    const args = ["-Fc", "-Z", "6", "-f", dumpPath, conn];
    const { stderr, code } = await runProcess(bin, args);
    if (code !== 0) {
        try {
            await (0, promises_1.unlink)(dumpPath);
        }
        catch {
            /* ignore */
        }
        try {
            await (0, promises_1.unlink)(metaPath);
        }
        catch {
            /* ignore */
        }
        const hint = stderr.includes("pg_dump") || stderr.includes("connection")
            ? " For Neon, set BACKUP_DATABASE_URL to the direct (non-pooler) connection string."
            : "";
        throw new Error(`pg_dump failed (exit ${code}): ${stderr || "no stderr"}${hint}`);
    }
    const st = await (0, promises_1.stat)(dumpPath);
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const meta = {
        name: label,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        format: "custom",
    };
    await (0, promises_1.writeFile)(metaPath, JSON.stringify(meta, null, 2), "utf8");
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
async function deletePgDumpBackup(backupId) {
    assertSafeBackupId(backupId);
    const root = getBackupStorageRoot();
    const dumpPath = (0, path_1.join)(root, `${backupId}${DUMP_EXT}`);
    const metaPath = (0, path_1.join)(root, `${backupId}${META_EXT}`);
    try {
        await (0, promises_1.unlink)(dumpPath);
    }
    catch (e) {
        if (e?.code !== "ENOENT")
            throw e;
    }
    try {
        await (0, promises_1.unlink)(metaPath);
    }
    catch {
        /* ignore */
    }
}
/**
 * Restores a custom-format dump into the database pointed to by BACKUP_DATABASE_URL or DATABASE_URL.
 * **Destructive**: drops existing objects. Enable only with `BACKUP_ALLOW_RESTORE=true`.
 */
async function restorePgDumpBackup(backupId) {
    assertSafeBackupId(backupId);
    if (process.env.BACKUP_ALLOW_RESTORE !== "true") {
        throw new Error("Database restore is disabled. Set environment variable BACKUP_ALLOW_RESTORE=true on the API server only when you intend to overwrite the database.");
    }
    const conn = resolveBackupConnectionString();
    if (!conn) {
        throw new Error("DATABASE_URL or BACKUP_DATABASE_URL is not set");
    }
    const root = getBackupStorageRoot();
    const dumpPath = (0, path_1.join)(root, `${backupId}${DUMP_EXT}`);
    try {
        await (0, promises_1.stat)(dumpPath);
    }
    catch {
        throw new Error("Backup file not found");
    }
    const bin = pgRestoreBinary();
    const args = ["--clean", "--if-exists", "--no-owner", "--no-acl", "-d", conn, dumpPath];
    const { stderr, code } = await runProcess(bin, args);
    if (code !== 0) {
        throw new Error(`pg_restore failed (exit ${code}): ${stderr || "no stderr"}`);
    }
}
