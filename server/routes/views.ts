import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import type { Todo } from "../domain/todo.js";
import { TodoRepository } from "../repositories/todo-repository.js";

function localDateKey(value: string | Date, timezone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function sortOpen(items: Todo[]): Todo[] {
  const priority = { high: 0, medium: 1, low: 2, none: 3 } as const;
  return [...items].sort((a, b) => {
    const due = (a.dueAtUtc ?? "9999").localeCompare(b.dueAtUtc ?? "9999");
    return due || priority[a.priority] - priority[b.priority] || a.createdAtUtc.localeCompare(b.createdAtUtc);
  });
}

export function registerViewRoutes(app: FastifyInstance, database: DatabaseSync, timezone: string): void {
  const todos = new TodoRepository(database);
  const open = () => todos.list({ status: "open" });
  app.get("/api/views/inbox", async () => ({ items: sortOpen(open().filter((todo) => !todo.dueAtUtc)) }));
  app.get("/api/views/today", async (request) => {
    const now = new Date((request.query as { now?: string }).now ?? Date.now());
    const today = localDateKey(now, timezone);
    return { items: sortOpen(open().filter((todo) => todo.dueAtUtc && localDateKey(todo.dueAtUtc, timezone) <= today)) };
  });
  app.get("/api/views/upcoming", async (request) => {
    const now = new Date((request.query as { now?: string }).now ?? Date.now());
    const today = localDateKey(now, timezone);
    return { items: sortOpen(open().filter((todo) => todo.dueAtUtc && localDateKey(todo.dueAtUtc, timezone) > today)) };
  });
  app.get("/api/views/recurring", async () => ({ items: sortOpen(open().filter((todo) => todo.recurrenceRule)) }));
  app.get("/api/views/completed", async () => ({ items: todos.list({ status: "completed" }) }));
  app.get("/api/search", async (request) => {
    const query = String((request.query as { q?: string }).q ?? "").trim().toLocaleLowerCase();
    const items = todos.list().filter((todo) => `${todo.title}\n${todo.notes}`.toLocaleLowerCase().includes(query));
    return { items };
  });
}
