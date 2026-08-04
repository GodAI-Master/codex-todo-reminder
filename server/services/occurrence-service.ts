import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { Todo } from "../domain/todo.js";
import { nextOccurrence } from "../domain/recurrence.js";

export type Occurrence = {
  id: string;
  todoId: string;
  scheduledAtUtc: string;
  reminderAtUtc: string | null;
  state: "scheduled" | "claimed" | "delivered" | "completed" | "snoozed" | "skipped";
  deliveredAtUtc: string | null;
  completedAtUtc: string | null;
  snoozedUntilUtc: string | null;
};

type OccurrenceRow = {
  id: string;
  todo_id: string;
  scheduled_at_utc: string;
  reminder_at_utc: string | null;
  state: Occurrence["state"];
  delivered_at_utc: string | null;
  completed_at_utc: string | null;
  snoozed_until_utc: string | null;
};

function mapOccurrence(row: OccurrenceRow): Occurrence {
  return {
    id: row.id,
    todoId: row.todo_id,
    scheduledAtUtc: row.scheduled_at_utc,
    reminderAtUtc: row.reminder_at_utc,
    state: row.state,
    deliveredAtUtc: row.delivered_at_utc,
    completedAtUtc: row.completed_at_utc,
    snoozedUntilUtc: row.snoozed_until_utc,
  };
}

const SELECT_OCCURRENCE = `
  SELECT id, todo_id, scheduled_at_utc, reminder_at_utc, state,
         delivered_at_utc, completed_at_utc, snoozed_until_utc
  FROM occurrences
`;

export class OccurrenceService {
  constructor(private readonly database: DatabaseSync) {}

  ensureForTodo(todo: Todo): Occurrence {
    const scheduledAtUtc = todo.dueAtUtc ?? todo.reminderAtUtc;
    if (!scheduledAtUtc) throw new Error("A scheduled todo requires a due or reminder time");
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT OR IGNORE INTO occurrences(
        id, todo_id, scheduled_at_utc, reminder_at_utc, state, created_at_utc, updated_at_utc
      ) VALUES (?, ?, ?, ?, 'scheduled', ?, ?)
    `).run(randomUUID(), todo.id, scheduledAtUtc, todo.reminderAtUtc ?? scheduledAtUtc, now, now);
    const row = this.database.prepare(
      `${SELECT_OCCURRENCE} WHERE todo_id = ? AND scheduled_at_utc = ?`,
    ).get(todo.id, scheduledAtUtc) as OccurrenceRow;
    return mapOccurrence(row);
  }

  listForTodo(todoId: string): Occurrence[] {
    return (this.database.prepare(
      `${SELECT_OCCURRENCE} WHERE todo_id = ? ORDER BY scheduled_at_utc`,
    ).all(todoId) as OccurrenceRow[]).map(mapOccurrence);
  }

  getActiveForTodo(todoId: string): Occurrence | null {
    const row = this.database.prepare(`
      ${SELECT_OCCURRENCE}
      WHERE todo_id = ? AND state IN ('scheduled', 'claimed', 'delivered', 'snoozed')
      ORDER BY scheduled_at_utc LIMIT 1
    `).get(todoId) as OccurrenceRow | undefined;
    return row ? mapOccurrence(row) : null;
  }

  complete(occurrenceId: string, completedAtUtc: string): void {
    this.database.prepare(`
      UPDATE occurrences
      SET state = 'completed', completed_at_utc = ?, updated_at_utc = ?
      WHERE id = ?
    `).run(completedAtUtc, completedAtUtc, occurrenceId);
  }

  snoozeForTodo(todoId: string, snoozedUntilUtc: string): Occurrence {
    const occurrence = this.getActiveForTodo(todoId);
    if (!occurrence) throw new Error("Todo has no active reminder");
    this.database.prepare(`
      UPDATE occurrences
      SET state = 'snoozed', snoozed_until_utc = ?, claim_token = NULL,
          claimed_at_utc = NULL, updated_at_utc = ?
      WHERE id = ?
    `).run(snoozedUntilUtc, new Date().toISOString(), occurrence.id);
    return this.getActiveForTodo(todoId)!;
  }

  rescheduleForTodo(todo: Todo): Occurrence | null {
    this.database.prepare(`
      DELETE FROM occurrences
      WHERE todo_id = ? AND state IN ('scheduled', 'claimed', 'snoozed')
    `).run(todo.id);
    if (!todo.dueAtUtc && !todo.reminderAtUtc) return null;
    return this.ensureForTodo(todo);
  }

  completeAndScheduleNext(occurrenceId: string, todo: Todo, completedAtUtc: string): Occurrence | null {
    const current = this.database.prepare(`${SELECT_OCCURRENCE} WHERE id = ?`)
      .get(occurrenceId) as OccurrenceRow | undefined;
    if (!current) throw new Error(`Occurrence '${occurrenceId}' not found`);
    this.database.prepare(`
      UPDATE occurrences
      SET state = 'completed', completed_at_utc = ?, updated_at_utc = ?
      WHERE id = ?
    `).run(completedAtUtc, completedAtUtc, occurrenceId);
    if (!todo.recurrenceRule) return null;
    const nextScheduled = nextOccurrence(todo.recurrenceRule, new Date(current.scheduled_at_utc));
    if (!nextScheduled) return null;
    const reminderOffset = todo.reminderAtUtc && todo.dueAtUtc
      ? new Date(todo.dueAtUtc).getTime() - new Date(todo.reminderAtUtc).getTime()
      : 0;
    const nextReminder = new Date(nextScheduled.getTime() - reminderOffset).toISOString();
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT OR IGNORE INTO occurrences(
        id, todo_id, scheduled_at_utc, reminder_at_utc, state, created_at_utc, updated_at_utc
      ) VALUES (?, ?, ?, ?, 'scheduled', ?, ?)
    `).run(randomUUID(), todo.id, nextScheduled.toISOString(), nextReminder, now, now);
    const row = this.database.prepare(
      `${SELECT_OCCURRENCE} WHERE todo_id = ? AND scheduled_at_utc = ?`,
    ).get(todo.id, nextScheduled.toISOString()) as OccurrenceRow;
    return mapOccurrence(row);
  }
}
