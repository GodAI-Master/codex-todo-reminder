import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { DatabaseSync } from "node:sqlite";

const MIGRATIONS = [
  {
    version: 1,
    url: new URL("./migrations/001_initial.sql", import.meta.url),
  },
];

export function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at_utc TEXT NOT NULL
    );
  `);
  const applied = new Set(
    database.prepare("SELECT version FROM schema_migrations").all().map((row) => Number(row.version)),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    const sql = readFileSync(fileURLToPath(migration.url), "utf8");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      database.prepare("INSERT INTO schema_migrations(version, applied_at_utc) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
