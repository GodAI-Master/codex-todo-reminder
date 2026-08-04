import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatabase, type TodoDatabase } from "../../server/db/database.js";
import { TodoRepository } from "../../server/repositories/todo-repository.js";
import { OccurrenceService } from "../../server/services/occurrence-service.js";
import { ReminderScheduler } from "../../server/services/reminder-scheduler.js";

describe("ReminderScheduler", () => {
  let database: TodoDatabase | undefined;
  afterEach(() => database?.close());

  it("delivers a due reminder exactly once across repeated scans", async () => {
    database = createDatabase(":memory:");
    const repo = new TodoRepository(database.raw);
    const todo = repo.create({
      title: "准时提醒",
      timezone: "Asia/Shanghai",
      dueAtUtc: "2026-08-04T08:10:00.000Z",
      reminderAtUtc: "2026-08-04T08:00:00.000Z",
    });
    new OccurrenceService(database.raw).ensureForTodo(todo);
    const send = vi.fn().mockResolvedValue(undefined);
    const scheduler = new ReminderScheduler({
      database: database.raw,
      notifier: { send },
      now: () => new Date("2026-08-04T08:00:05.000Z"),
    });

    await scheduler.runOnce();
    await scheduler.runOnce();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].todo.title).toBe("准时提醒");
  });

  it("retries a failed delivery without crashing", async () => {
    database = createDatabase(":memory:");
    const repo = new TodoRepository(database.raw);
    const todo = repo.create({
      title: "失败后重试",
      timezone: "Asia/Shanghai",
      reminderAtUtc: "2026-08-04T08:00:00.000Z",
    });
    new OccurrenceService(database.raw).ensureForTodo(todo);
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("toast unavailable"))
      .mockResolvedValueOnce(undefined);
    const scheduler = new ReminderScheduler({
      database: database.raw,
      notifier: { send },
      now: () => new Date("2026-08-04T08:01:00.000Z"),
      retryDelayMs: 0,
    });

    await scheduler.runOnce();
    await scheduler.runOnce();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("limits recovered reminders so startup does not create a notification burst", async () => {
    database = createDatabase(":memory:");
    const repo = new TodoRepository(database.raw);
    const occurrences = new OccurrenceService(database.raw);
    for (let index = 0; index < 5; index += 1) {
      const todo = repo.create({
        title: `补发提醒 ${index + 1}`,
        timezone: "Asia/Shanghai",
        reminderAtUtc: new Date(Date.parse("2026-08-04T08:00:00.000Z") - (index + 2) * 60_000).toISOString(),
      });
      occurrences.ensureForTodo(todo);
    }
    const send = vi.fn().mockResolvedValue(undefined);
    const scheduler = new ReminderScheduler({
      database: database.raw,
      notifier: { send },
      now: () => new Date("2026-08-04T08:00:00.000Z"),
      maxMissedNotificationsPerScan: 3,
    });

    await scheduler.runOnce();

    expect(send).toHaveBeenCalledTimes(3);
    const states = database.raw.prepare("SELECT state, COUNT(*) AS count FROM occurrences GROUP BY state").all() as Array<{ state: string; count: number }>;
    expect(Object.fromEntries(states.map((row) => [row.state, Number(row.count)]))).toEqual({ delivered: 3, skipped: 2 });
  });

  it("stops retrying after three notification failures", async () => {
    database = createDatabase(":memory:");
    const repo = new TodoRepository(database.raw);
    const todo = repo.create({ title: "提醒服务不可用", timezone: "Asia/Shanghai", reminderAtUtc: "2026-08-04T08:00:00.000Z" });
    new OccurrenceService(database.raw).ensureForTodo(todo);
    const send = vi.fn().mockRejectedValue(new Error("toast unavailable"));
    const scheduler = new ReminderScheduler({
      database: database.raw,
      notifier: { send },
      now: () => new Date("2026-08-04T08:00:05.000Z"),
      retryDelayMs: 0,
      maxDeliveryAttempts: 3,
    });

    await scheduler.runOnce();
    await scheduler.runOnce();
    await scheduler.runOnce();
    await scheduler.runOnce();

    expect(send).toHaveBeenCalledTimes(3);
    expect(database.raw.prepare("SELECT state FROM occurrences").get()).toMatchObject({ state: "skipped" });
  });

  it("skips reminders whose todo has been deleted", async () => {
    database = createDatabase(":memory:");
    const repo = new TodoRepository(database.raw);
    const todo = repo.create({ title: "已删除事项", timezone: "Asia/Shanghai", reminderAtUtc: "2026-08-04T08:00:00.000Z" });
    new OccurrenceService(database.raw).ensureForTodo(todo);
    repo.softDelete(todo.id);
    const send = vi.fn().mockResolvedValue(undefined);
    const scheduler = new ReminderScheduler({ database: database.raw, notifier: { send }, now: () => new Date("2026-08-04T08:00:05.000Z") });

    await scheduler.runOnce();

    expect(send).not.toHaveBeenCalled();
    expect(database.raw.prepare("SELECT state FROM occurrences").get()).toMatchObject({ state: "skipped" });
  });
});
