import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { TodoRepository } from "../repositories/todo-repository.js";

export type PortableData = {
  format: "codex-todo-reminder";
  version: 1;
  exportedAtUtc: string;
  lists: unknown[];
  todos: unknown[];
};

export class ImportExportService {
  constructor(private readonly database: DatabaseSync) {}

  export(): PortableData {
    return {
      format: "codex-todo-reminder",
      version: 1,
      exportedAtUtc: new Date().toISOString(),
      lists: this.database.prepare("SELECT * FROM lists ORDER BY sort_order").all(),
      todos: new TodoRepository(this.database).list({ includeDeleted: true }),
    };
  }

  preview(data: unknown): { valid: true; lists: number; todos: number } {
    if (!data || typeof data !== "object") throw new Error("Import data must be an object");
    const candidate = data as Partial<PortableData>;
    if (candidate.format !== "codex-todo-reminder" || candidate.version !== 1) throw new Error("Unsupported import format");
    if (!Array.isArray(candidate.lists) || !Array.isArray(candidate.todos)) throw new Error("Import data is incomplete");
    for (const todo of candidate.todos) {
      if (!todo || typeof todo !== "object" || typeof (todo as { title?: unknown }).title !== "string") throw new Error("Import contains an invalid todo");
    }
    return { valid: true, lists: candidate.lists.length, todos: candidate.todos.length };
  }

  merge(data: unknown): { listsAdded: number; todosAdded: number; skipped: number } {
    this.preview(data);
    const candidate = data as PortableData;
    let listsAdded = 0;
    let todosAdded = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const raw of candidate.lists as Array<Record<string, unknown>>) {
        if (typeof raw.id !== "string" || typeof raw.name !== "string") { skipped += 1; continue; }
        const result = this.database.prepare(`
          INSERT OR IGNORE INTO lists(id,name,color,sort_order,archived,created_at_utc,updated_at_utc)
          VALUES (?,?,?,?,?,?,?)
        `).run(raw.id, raw.name, String(raw.color ?? "#64748B"), Number(raw.sort_order ?? raw.sortOrder ?? 0), raw.archived ? 1 : 0, String(raw.created_at_utc ?? raw.createdAtUtc ?? now), now);
        listsAdded += Number(result.changes);
      }
      for (const raw of candidate.todos as Array<Record<string, unknown>>) {
        if (typeof raw.title !== "string") { skipped += 1; continue; }
        const existingId = typeof raw.id === "string" ? raw.id : randomUUID();
        const result = this.database.prepare(`
          INSERT OR IGNORE INTO todos(
            id,title,notes,list_id,priority,status,due_at_utc,reminder_at_utc,timezone,
            recurrence_rule,completed_at_utc,deleted_at_utc,created_at_utc,updated_at_utc
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          existingId, raw.title, String(raw.notes ?? ""), asNullableString(raw.listId),
          String(raw.priority ?? "none"), String(raw.status ?? "open"), asNullableString(raw.dueAtUtc),
          asNullableString(raw.reminderAtUtc), String(raw.timezone ?? "Asia/Shanghai"), asNullableString(raw.recurrenceRule),
          asNullableString(raw.completedAtUtc), asNullableString(raw.deletedAtUtc), String(raw.createdAtUtc ?? now), now,
        );
        if (Number(result.changes)) todosAdded += 1; else skipped += 1;
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return { listsAdded, todosAdded, skipped };
  }
}

function asNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
