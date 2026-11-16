import fs from "fs";
import path from "path";

// Server-only helpers for the SQLite file itself. The journal is the user's
// only copy, so both the updater and the backup route must agree on where it
// lives and what a usable copy looks like.
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, "backups");

// Prisma resolves a relative SQLite URL against the schema's directory, so the
// live file is prisma/prisma/quantedge.db even though DATABASE_URL reads
// "file:./prisma/quantedge.db". Both layouts are checked, same as the updater.
export function findDatabasePath(): string | null {
  const candidates = [
    path.join(ROOT, "prisma", "prisma", "quantedge.db"),
    path.join(ROOT, "prisma", "quantedge.db"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export function ensureBackupDir(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

export interface BackupFile {
  name: string;
  size: number;
  modified: number;
}

// A zero-byte backup is worse than no backup: it looks like a safety net and
// restores as an empty database. Refuse to hand one out.
export function createBackup(prefix = "quantedge"): BackupFile | null {
  const dbPath = findDatabasePath();
  if (!dbPath) return null;

  const dir = ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = `${prefix}-${ts}.db`;
  const dest = path.join(dir, name);
  fs.copyFileSync(dbPath, dest);

  const size = fs.statSync(dest).size;
  if (size === 0) {
    fs.unlinkSync(dest);
    throw new Error("Backup produced a 0-byte file");
  }
  pruneBackups(dir, prefix, prefix === "quantedge" ? 5 : 3);
  return { name, size, modified: Date.now() };
}

export function listBackups(): BackupFile[] {
  const dir = BACKUP_DIR;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, modified: stat.mtimeMs };
    })
    .sort((a, b) => b.modified - a.modified);
}

// Backups are pruned per family so a pre-restore copy never evicts the rolling
// pre-update set (and vice versa).
export function pruneBackups(dir: string, prefix: string, keep: number): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith(".db"))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const file of files.slice(keep)) fs.unlinkSync(path.join(dir, file.name));
  } catch {
    // Pruning is housekeeping; never fail the backup because of it.
  }
}

export function backupPath(name: string): string | null {
  // Only names this module could have produced, and only inside backups/.
  if (!/^[a-z0-9-]+\.db$/i.test(name)) return null;
  const full = path.resolve(BACKUP_DIR, name);
  if (path.dirname(full) !== path.resolve(BACKUP_DIR)) return null;
  return fs.existsSync(full) ? full : null;
}

// SQLite's file header, so a renamed PDF or a truncated upload is rejected
// before it can replace a healthy database.
export function isSqliteFile(bytes: Buffer): boolean {
  return bytes.length > 100 && bytes.subarray(0, 16).toString("latin1") === "SQLite format 3\u0000";
}

export function discardWalFiles(dbPath: string): void {
  // The -wal and -shm belong to the database that was just replaced. Leaving
  // them behind lets SQLite replay pages from the old file into the new one.
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    try { fs.unlinkSync(dbPath + suffix); } catch { /* absent is fine */ }
  }
}
