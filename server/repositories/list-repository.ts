import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type TodoList = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

type ListRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  archived: number;
  created_at_utc: string;
  updated_at_utc: string;
};

function mapList(row: ListRow): TodoList {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    archived: row.archived === 1,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
  };
}

export class ListRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(includeArchived = false): TodoList[] {
    const rows = this.database.prepare(`
      SELECT id, name, color, sort_order, archived, created_at_utc, updated_at_utc
      FROM lists ${includeArchived ? "" : "WHERE archived = 0"}
      ORDER BY sort_order, created_at_utc
    `).all() as ListRow[];
    return rows.map(mapList);
  }

  create(input: { name: string; color?: string | undefined }): TodoList {
    const id = randomUUID();
    const now = new Date().toISOString();
    const nextOrder = Number((this.database.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM lists").get() as { next_order: number }).next_order);
    this.database.prepare(`
      INSERT INTO lists(id, name, color, sort_order, archived, created_at_utc, updated_at_utc)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, input.name, input.color ?? "#64748B", nextOrder, now, now);
    return this.getRequired(id);
  }

  update(id: string, input: {
    name?: string | undefined;
    color?: string | undefined;
    archived?: boolean | undefined;
    sortOrder?: number | undefined;
  }): TodoList {
    this.getRequired(id);
    const assignments: string[] = [];
    const values: Array<string | number> = [];
    if (input.name !== undefined) { assignments.push("name = ?"); values.push(input.name); }
    if (input.color !== undefined) { assignments.push("color = ?"); values.push(input.color); }
    if (input.archived !== undefined) { assignments.push("archived = ?"); values.push(input.archived ? 1 : 0); }
    if (input.sortOrder !== undefined) { assignments.push("sort_order = ?"); values.push(input.sortOrder); }
    if (assignments.length > 0) {
      assignments.push("updated_at_utc = ?");
      values.push(new Date().toISOString(), id);
      this.database.prepare(`UPDATE lists SET ${assignments.join(", ")} WHERE id = ?`).run(...values);
    }
    return this.getRequired(id);
  }

  getRequired(id: string): TodoList {
    const row = this.database.prepare(`
      SELECT id, name, color, sort_order, archived, created_at_utc, updated_at_utc
      FROM lists WHERE id = ?
    `).get(id) as ListRow | undefined;
    if (!row) throw new Error(`List '${id}' not found`);
    return mapList(row);
  }
}
