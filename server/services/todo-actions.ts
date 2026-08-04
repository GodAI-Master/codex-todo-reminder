import type { DatabaseSync } from "node:sqlite";

import type { Todo } from "../domain/todo.js";
import { TodoRepository } from "../repositories/todo-repository.js";
import type { EventBus } from "./event-bus.js";
import { OccurrenceService } from "./occurrence-service.js";

export function completeTodo(database: DatabaseSync, reference: string, events?: EventBus): Todo {
  const todos = new TodoRepository(database);
  const occurrences = new OccurrenceService(database);
  const todo = todos.getRequiredByReference(reference);
  const active = occurrences.getActiveForTodo(todo.id);
  if (todo.recurrenceRule && active) {
    const next = occurrences.completeAndScheduleNext(active.id, todo, new Date().toISOString());
    if (next) {
      const reminderOffset = todo.reminderAtUtc && todo.dueAtUtc
        ? new Date(todo.dueAtUtc).getTime() - new Date(todo.reminderAtUtc).getTime()
        : 0;
      const updated = todos.update(todo.id, {
        dueAtUtc: next.scheduledAtUtc,
        reminderAtUtc: new Date(new Date(next.scheduledAtUtc).getTime() - reminderOffset).toISOString(),
      });
      events?.emit({ type: "todo.changed", id: todo.id });
      return updated;
    }
  }
  if (active) occurrences.complete(active.id, new Date().toISOString());
  const completed = todos.complete(todo.id);
  events?.emit({ type: "todo.changed", id: todo.id });
  return completed;
}

export function snoozeTodo(database: DatabaseSync, reference: string, minutes: number, events?: EventBus): void {
  const todos = new TodoRepository(database);
  const todo = todos.getRequiredByReference(reference);
  new OccurrenceService(database).snoozeForTodo(
    todo.id,
    new Date(Date.now() + minutes * 60_000).toISOString(),
  );
  events?.emit({ type: "todo.changed", id: todo.id });
}
