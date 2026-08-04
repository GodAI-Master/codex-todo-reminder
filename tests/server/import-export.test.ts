import { afterEach, describe, expect, it } from "vitest";

import { createDatabase, type TodoDatabase } from "../../server/db/database.js";
import { TodoRepository } from "../../server/repositories/todo-repository.js";
import { ImportExportService } from "../../server/services/import-export-service.js";

describe("portable data", () => {
  let database: TodoDatabase | undefined;
  afterEach(() => database?.close());

  it("exports previews and merges todos", () => {
    database = createDatabase(":memory:");
    new TodoRepository(database.raw).create({ title: "可迁移待办", timezone: "Asia/Shanghai" });
    const portable = new ImportExportService(database.raw);
    const data = portable.export();
    expect(portable.preview(data)).toMatchObject({ valid: true, todos: 1 });

    const second = createDatabase(":memory:");
    try {
      const result = new ImportExportService(second.raw).merge(data);
      expect(result.todosAdded).toBe(1);
      expect(new TodoRepository(second.raw).list()).toHaveLength(1);
    } finally { second.close(); }
  });
});
