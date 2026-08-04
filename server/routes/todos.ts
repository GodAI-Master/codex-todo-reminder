import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { TodoRepository } from "../repositories/todo-repository.js";
import { OccurrenceService } from "../services/occurrence-service.js";
import { createTodoSchema, normalizeCreateInput, normalizeUpdateInput, snoozeSchema, updateTodoSchema } from "../schemas/todo-schema.js";
import type { EventBus } from "../services/event-bus.js";
import { completeTodo } from "../services/todo-actions.js";

function idParam(request: { params: unknown }): string {
  return (request.params as { id: string }).id;
}

export function registerTodoRoutes(
  app: FastifyInstance,
  database: DatabaseSync,
  timezone: string,
  events?: EventBus,
): void {
  const todos = new TodoRepository(database);
  const occurrences = new OccurrenceService(database);

  app.post("/api/todos", async (request, reply) => {
    const input = normalizeCreateInput(createTodoSchema.parse(request.body), timezone);
    const todo = todos.create(input);
    if (todo.dueAtUtc || todo.reminderAtUtc) occurrences.ensureForTodo(todo);
    events?.emit({ type: "todo.changed", id: todo.id });
    return reply.code(201).send(todo);
  });

  app.get("/api/todos/:id", async (request) => todos.getRequiredByReference(idParam(request)));

  app.patch("/api/todos/:id", async (request) => {
    const input = normalizeUpdateInput(updateTodoSchema.parse(request.body));
    const resolved = todos.getRequiredByReference(idParam(request));
    const todo = todos.update(resolved.id, input);
    occurrences.rescheduleForTodo(todo);
    events?.emit({ type: "todo.changed", id: todo.id });
    return todo;
  });

  app.post("/api/todos/:id/complete", async (request) => {
    return completeTodo(database, idParam(request), events);
  });

  app.post("/api/todos/:id/restore", async (request) => {
    const id = todos.getRequiredByReference(idParam(request), { includeDeleted: true }).id;
    const restored = todos.restore(id);
    events?.emit({ type: "todo.changed", id });
    return restored;
  });

  app.post("/api/todos/:id/snooze", async (request) => {
    const input = snoozeSchema.parse(request.body);
    const id = todos.getRequiredByReference(idParam(request)).id;
    const now = new Date(input.now ?? Date.now());
    const snoozed = occurrences.snoozeForTodo(id, new Date(now.getTime() + input.minutes * 60_000).toISOString());
    events?.emit({ type: "todo.changed", id });
    return snoozed;
  });

  app.delete("/api/todos/:id", async (request, reply) => {
    const id = todos.getRequiredByReference(idParam(request), { includeDeleted: true }).id;
    todos.softDelete(id);
    events?.emit({ type: "todo.changed", id });
    return reply.code(204).send();
  });
}
