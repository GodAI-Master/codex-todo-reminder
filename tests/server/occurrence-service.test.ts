import { afterEach, describe, expect, it } from "vitest";

import { createDatabase, type TodoDatabase } from "../../server/db/database.js";
import { TodoRepository } from "../../server/repositories/todo-repository.js";
import { OccurrenceService } from "../../server/services/occurrence-service.js";

describe("OccurrenceService", () => {
  let database: TodoDatabase | undefined;
  afterEach(() => database?.close());

  it("creates each scheduled occurrence only once", () => {
    database = createDatabase(":memory:");
    const repo = new TodoRepository(database.raw);
    const todo = repo.create({
      title: "每日回顾",
      timezone: "Asia/Shanghai",
      dueAtUtc: "2026-08-05T13:00:00.000Z",
      reminderAtUtc: "2026-08-05T12:50:00.000Z",
      recurrenceRule: "FREQ=DAILY;INTERVAL=1",
    });
    const service = new OccurrenceService(database.raw);

    const first = service.ensureForTodo(todo);
    const second = service.ensureForTodo(todo);

    expect(first.id).toBe(second.id);
    expect(service.listForTodo(todo.id)).toHaveLength(1);
  });

  it("completes a recurring occurrence and creates the next one", () => {
    database = createDatabase(":memory:");
    const repo = new TodoRepository(database.raw);
    const todo = repo.create({
      title: "每日回顾",
      timezone: "Asia/Shanghai",
      dueAtUtc: "2026-08-05T13:00:00.000Z",
      reminderAtUtc: "2026-08-05T12:50:00.000Z",
      recurrenceRule: "FREQ=DAILY;INTERVAL=1",
    });
    const service = new OccurrenceService(database.raw);
    const occurrence = service.ensureForTodo(todo);

    const next = service.completeAndScheduleNext(occurrence.id, todo, "2026-08-05T13:01:00.000Z");

    expect(next?.scheduledAtUtc).toBe("2026-08-06T13:00:00.000Z");
    expect(service.listForTodo(todo.id)).toHaveLength(2);
  });
});
