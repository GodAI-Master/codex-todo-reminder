import { DatabaseSync } from "node:sqlite";

import { migrate } from "./migrate.js";

export class TodoDatabase {
  constructor(public readonly raw: DatabaseSync) {}

  close(): void {
    if (this.raw.isOpen) this.raw.close();
  }
}

export function createDatabase(databasePath: string): TodoDatabase {
  const raw = new DatabaseSync(databasePath, { timeout: 5_000 });
  raw.exec("PRAGMA foreign_keys = ON");
  raw.exec("PRAGMA busy_timeout = 5000");
  if (databasePath !== ":memory:") raw.exec("PRAGMA journal_mode = WAL");
  migrate(raw);
  return new TodoDatabase(raw);
}
