import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { CreateTodoInput, Todo, TodoPriority, TodoStatus, UpdateTodoInput } from "../domain/todo.js";

type TodoRow = {
  todo_number: number;
  id: string;
  title: string;
  notes: string;
  list_id: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  due_at_utc: string | null;
  reminder_at_utc: string | null;
  timezone: string;
  recurrence_rule: string | null;
  completed_at_utc: string | null;
  deleted_at_utc: string | null;
  created_at_utc: string;
  updated_at_utc: string;
};

function mapTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    displayId: `TODO-${String(row.todo_number).padStart(4, "0")}`,
    title: row.title,
    notes: row.notes,
    listId: row.list_id,
    priority: row.priority,
    status: row.status,
    dueAtUtc: row.due_at_utc,
    reminderAtUtc: row.reminder_at_utc,
    timezone: row.timezone,
    recurrenceRule: row.recurrence_rule,
    completedAtUtc: row.completed_at_utc,
    deletedAtUtc: row.deleted_at_utc,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
  };
}

const SELECT_TODO = `
  SELECT todo_number, id, title, notes, list_id, priority, status,
         due_at_utc, reminder_at_utc, timezone, recurrence_rule,
         completed_at_utc, deleted_at_utc, created_at_utc, updated_at_utc
  FROM todos
`;

export class TodoNotFoundError extends Error {
  constructor(id: string) {
    super(`Todo '${id}' not found`);
    this.name = "TodoNotFoundError";
  }
}

export class TodoRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateTodoInput): Todo {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO todos(
        id, title, notes, list_id, priority, status, due_at_utc,
        reminder_at_utc, timezone, recurrence_rule, created_at_utc, updated_at_utc
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.title,
      input.notes ?? "",
      input.listId ?? null,
      input.priority ?? "none",
      input.dueAtUtc ?? null,
      input.reminderAtUtc ?? null,
      input.timezone,
      input.recurrenceRule ?? null,
      now,
      now,
    );
    return this.getRequired(id);
  }

  get(id: string, options: { includeDeleted?: boolean } = {}): Todo | null {
    const row = this.database.prepare(
      `${SELECT_TODO} WHERE id = ?${options.includeDeleted ? "" : " AND status != 'deleted'"}`,
    ).get(id) as TodoRow | undefined;
    return row ? mapTodo(row) : null;
  }

  getRequired(id: string, options: { includeDeleted?: boolean } = {}): Todo {
    const todo = this.get(id, options);
    if (!todo) throw new TodoNotFoundError(id);
    return todo;
  }

  getByReference(reference: string, options: { includeDeleted?: boolean } = {}): Todo | null {
    const match = /^TODO-(\d+)$/i.exec(reference.trim());
    if (!match) return this.get(reference, options);
    const row = this.database.prepare(
      `${SELECT_TODO} WHERE todo_number = ?${options.includeDeleted ? "" : " AND status != 'deleted'"}`,
    ).get(Number(match[1])) as TodoRow | undefined;
    return row ? mapTodo(row) : null;
  }

  getRequiredByReference(reference: string, options: { includeDeleted?: boolean } = {}): Todo {
    const todo = this.getByReference(reference, options);
    if (!todo) throw new TodoNotFoundError(reference);
    return todo;
  }

  update(id: string, input: UpdateTodoInput): Todo {
    this.getRequired(id);
    const fieldMap: Record<string, string> = {
      title: "title",
      notes: "notes",
      listId: "list_id",
      priority: "priority",
      dueAtUtc: "due_at_utc",
      reminderAtUtc: "reminder_at_utc",
      timezone: "timezone",
      recurrenceRule: "recurrence_rule",
    };
    const assignments: string[] = [];
    const values: Array<string | null> = [];
    for (const [key, column] of Object.entries(fieldMap)) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      assignments.push(`${column} = ?`);
      values.push((input as Record<string, string | null | undefined>)[key] ?? null);
    }
    if (assignments.length === 0) return this.getRequired(id);
    assignments.push("updated_at_utc = ?");
    values.push(new Date().toISOString(), id);
    this.database.prepare(`UPDATE todos SET ${assignments.join(", ")} WHERE id = ?`).run(...values);
    return this.getRequired(id);
  }

  complete(id: string, completedAtUtc = new Date().toISOString()): Todo {
    this.getRequired(id);
    this.database.prepare(`
      UPDATE todos
      SET status = 'completed', completed_at_utc = ?, updated_at_utc = ?
      WHERE id = ?
    `).run(completedAtUtc, completedAtUtc, id);
    return this.getRequired(id);
  }

  restore(id: string): Todo {
    this.getRequired(id, { includeDeleted: true });
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE todos
      SET status = 'open', completed_at_utc = NULL, deleted_at_utc = NULL, updated_at_utc = ?
      WHERE id = ?
    `).run(now, id);
    return this.getRequired(id);
  }

  softDelete(id: string, deletedAtUtc = new Date().toISOString()): void {
    this.getRequired(id, { includeDeleted: true });
    this.database.prepare(`
      UPDATE todos SET status = 'deleted', deleted_at_utc = ?, updated_at_utc = ? WHERE id = ?
    `).run(deletedAtUtc, deletedAtUtc, id);
  }

  list(options: { status?: TodoStatus; listId?: string | null; includeDeleted?: boolean } = {}): Todo[] {
    const where: string[] = [];
    const values: Array<string | null> = [];
    if (!options.includeDeleted) where.push("status != 'deleted'");
    if (options.status) {
      where.push("status = ?");
      values.push(options.status);
    }
    if (Object.prototype.hasOwnProperty.call(options, "listId")) {
      where.push("list_id IS ?");
      values.push(options.listId ?? null);
    }
    const sql = `${SELECT_TODO}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at_utc DESC`;
    return (this.database.prepare(sql).all(...values) as TodoRow[]).map(mapTodo);
  }
}
