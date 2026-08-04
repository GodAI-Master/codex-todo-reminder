import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { resolveConfig } from "../../server/config.js";
import { createDatabase } from "../../server/db/database.js";
import { TodoRepository } from "../../server/repositories/todo-repository.js";
import { applyPendingRestore, BackupService } from "../../server/services/backup-service.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()))) throw new Error("Refusing unsafe test cleanup");
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("BackupService", () => {
  it("creates an integrity-checked backup and restores it on the next start", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "codex-todo-backup-"));
    temporaryDirectories.push(directory);
    const config = resolveConfig({ dataDir: directory });
    let database = createDatabase(config.databasePath);
    let todos = new TodoRepository(database.raw);
    todos.create({ title: "保留在备份里的任务", timezone: "Asia/Shanghai" });

    const service = new BackupService(database.raw, config);
    const backupName = await service.create(true);
    expect(backupName).toMatch(/-manual-/);
    service.stageRestore(backupName!);
    todos.create({ title: "备份后新增的任务", timezone: "Asia/Shanghai" });
    database.close();

    expect(applyPendingRestore(config)).toBe(true);
    database = createDatabase(config.databasePath);
    todos = new TodoRepository(database.raw);
    expect(todos.list().map((todo) => todo.title)).toEqual(["保留在备份里的任务"]);
    database.close();
  });
});
