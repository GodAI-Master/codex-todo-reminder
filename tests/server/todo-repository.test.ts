import { afterEach, describe, expect, it } from "vitest";

import { createDatabase, type TodoDatabase } from "../../server/db/database.js";
import { TodoRepository } from "../../server/repositories/todo-repository.js";

describe("TodoRepository", () => {
  let database: TodoDatabase | undefined;

  afterEach(() => database?.close());

  function repository() {
    database = createDatabase(":memory:");
    return new TodoRepository(database.raw);
  }

  it("creates and reads a todo with a human display id", () => {
    const repo = repository();
    const todo = repo.create({
      title: "整理项目总结",
      notes: "周五前发出",
      priority: "high",
      timezone: "Asia/Shanghai",
      dueAtUtc: "2026-08-05T07:00:00.000Z",
      reminderAtUtc: "2026-08-05T06:30:00.000Z",
    });

    expect(todo.displayId).toBe("TODO-0001");
    expect(repo.get(todo.id)).toEqual(todo);
  });

  it("completes restores and soft deletes a todo", () => {
    const repo = repository();
    const todo = repo.create({ title: "提交周报", timezone: "Asia/Shanghai" });

    expect(repo.complete(todo.id, "2026-08-04T08:00:00.000Z").status).toBe("completed");
    expect(repo.restore(todo.id).status).toBe("open");
    repo.softDelete(todo.id, "2026-08-04T09:00:00.000Z");
    expect(repo.get(todo.id)).toBeNull();
    expect(repo.get(todo.id, { includeDeleted: true })?.status).toBe("deleted");
  });

  it("throws for unknown todo updates", () => {
    const repo = repository();
    expect(() => repo.update("missing", { title: "不存在" })).toThrowError(/not found/i);
  });
});
