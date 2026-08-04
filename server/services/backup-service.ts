import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import type { AppConfig } from "../config.js";

const BACKUP_PATTERN = /^todo-\d{4}-\d{2}-\d{2}(?:-manual-\d{6})?\.sqlite$/;

export class BackupService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly config: AppConfig,
  ) {}

  list(): Array<{ name: string; size: number; modifiedAtUtc: string }> {
    if (this.config.backupDir === ":memory:" || !existsSync(this.config.backupDir)) return [];
    return readdirSync(this.config.backupDir)
      .filter((name) => BACKUP_PATTERN.test(name))
      .map((name) => {
        const info = statSync(path.join(this.config.backupDir, name));
        return { name, size: info.size, modifiedAtUtc: info.mtime.toISOString() };
      })
      .sort((left, right) => right.name.localeCompare(left.name));
  }

  async create(manual = false): Promise<string | null> {
    if (this.config.backupDir === ":memory:") return null;
    mkdirSync(this.config.backupDir, { recursive: true });
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 19).replaceAll(":", "");
    const name = manual ? `todo-${day}-manual-${time}.sqlite` : `todo-${day}.sqlite`;
    const destination = path.join(this.config.backupDir, name);
    if (!manual && existsSync(destination)) return name;
    await backup(this.database, destination);
    const check = new DatabaseSync(destination, { readOnly: true });
    try {
      const result = check.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
      if (result.integrity_check !== "ok") throw new Error("Backup integrity check failed");
    } finally { check.close(); }
    this.prune(14);
    return name;
  }

  stageRestore(name: string): void {
    if (!BACKUP_PATTERN.test(name)) throw new Error("Invalid backup name");
    const source = path.join(this.config.backupDir, name);
    if (!existsSync(source)) throw new Error("Backup not found");
    const pending = path.join(this.config.dataDir, "restore.pending.sqlite");
    copyFileSync(source, pending);
    writeFileSync(path.join(this.config.dataDir, "restore.pending.json"), JSON.stringify({ name, stagedAtUtc: new Date().toISOString() }), "utf8");
  }

  private prune(keep: number): void {
    const automatic = this.list().filter((item) => !item.name.includes("-manual-"));
    for (const item of automatic.slice(keep)) rmSync(path.join(this.config.backupDir, item.name), { force: true });
  }
}

export function applyPendingRestore(config: AppConfig): boolean {
  if (config.dataDir === ":memory:") return false;
  const marker = path.join(config.dataDir, "restore.pending.json");
  const pending = path.join(config.dataDir, "restore.pending.sqlite");
  if (!existsSync(marker) || !existsSync(pending)) return false;
  JSON.parse(readFileSync(marker, "utf8"));
  const check = new DatabaseSync(pending, { readOnly: true });
  try {
    const result = check.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    if (result.integrity_check !== "ok") throw new Error("Pending restore database is corrupt");
  } finally { check.close(); }
  if (existsSync(config.databasePath)) copyFileSync(config.databasePath, `${config.databasePath}.pre-restore`);
  copyFileSync(pending, config.databasePath);
  rmSync(pending, { force: true });
  rmSync(marker, { force: true });
  return true;
}
