import { afterEach, describe, expect, it } from "vitest";

import { createDatabase, type TodoDatabase } from "../../server/db/database.js";

describe("database migrations", () => {
  let database: TodoDatabase | undefined;

  afterEach(() => database?.close());

  it("creates the complete schema with safety pragmas", () => {
    database = createDatabase(":memory:");
    const tables = database.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name));

    expect(tables).toEqual(expect.arrayContaining([
      "lists",
      "todos",
      "occurrences",
      "notification_deliveries",
      "settings",
      "schema_migrations",
    ]));
    expect(database.raw.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    expect(database.raw.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "memory" });
  });

  it("creates the unique occurrence schedule index", () => {
    database = createDatabase(":memory:");
    const indexes = database.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => String(row.name));

    expect(indexes).toContain("occurrences_todo_scheduled_unique");
  });
});
