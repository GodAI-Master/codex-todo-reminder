import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { ReminderNotifier } from "../notifications/notifier.js";
import { TodoRepository } from "../repositories/todo-repository.js";
import type { Occurrence } from "./occurrence-service.js";
import { shouldDeliverMissedReminder } from "./missed-reminder-policy.js";

type SchedulerOptions = {
  database: DatabaseSync;
  notifier: ReminderNotifier;
  now?: () => Date;
  intervalMs?: number;
  retryDelayMs?: number;
  missedWindowMinutes?: number;
};

type DueRow = {
  id: string;
  todo_id: string;
  scheduled_at_utc: string;
  reminder_at_utc: string | null;
  state: Occurrence["state"];
  delivered_at_utc: string | null;
  completed_at_utc: string | null;
  snoozed_until_utc: string | null;
  effective_reminder_at_utc: string;
};

export class ReminderScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private readonly now: () => Date;
  private readonly intervalMs: number;
  private readonly retryDelayMs: number;
  private readonly missedWindowMinutes: number;

  constructor(private readonly options: SchedulerOptions) {
    this.now = options.now ?? (() => new Date());
    this.intervalMs = options.intervalMs ?? 15_000;
    this.retryDelayMs = options.retryDelayMs ?? 60_000;
    this.missedWindowMinutes = options.missedWindowMinutes ?? 24 * 60;
  }

  start(): void {
    if (this.timer) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = this.now();
      const nowIso = now.toISOString();
      const staleClaim = new Date(now.getTime() - 2 * 60_000).toISOString();
      this.options.database.prepare(`
        UPDATE occurrences
        SET state = 'scheduled', claim_token = NULL, claimed_at_utc = NULL, updated_at_utc = ?
        WHERE state = 'claimed' AND claimed_at_utc < ?
      `).run(nowIso, staleClaim);
      const due = this.options.database.prepare(`
        SELECT id, todo_id, scheduled_at_utc, reminder_at_utc, state,
               delivered_at_utc, completed_at_utc, snoozed_until_utc,
               COALESCE(snoozed_until_utc, reminder_at_utc, scheduled_at_utc) AS effective_reminder_at_utc
        FROM occurrences
        WHERE state IN ('scheduled', 'snoozed')
          AND COALESCE(snoozed_until_utc, reminder_at_utc, scheduled_at_utc) <= ?
        ORDER BY effective_reminder_at_utc
        LIMIT 50
      `).all(nowIso) as DueRow[];
      for (const row of due) await this.deliver(row, now);
    } finally {
      this.running = false;
    }
  }

  private async deliver(row: DueRow, now: Date): Promise<void> {
    const scheduled = new Date(row.effective_reminder_at_utc);
    if (!shouldDeliverMissedReminder(scheduled, now, this.missedWindowMinutes)) {
      this.options.database.prepare("UPDATE occurrences SET state = 'skipped', updated_at_utc = ? WHERE id = ?")
        .run(now.toISOString(), row.id);
      return;
    }
    const claimToken = randomUUID();
    const claimed = this.options.database.prepare(`
      UPDATE occurrences
      SET state = 'claimed', claim_token = ?, claimed_at_utc = ?, updated_at_utc = ?
      WHERE id = ? AND state IN ('scheduled', 'snoozed')
    `).run(claimToken, now.toISOString(), now.toISOString(), row.id);
    if (Number(claimed.changes) !== 1) return;

    const deliveryId = randomUUID();
    this.options.database.prepare(`
      INSERT INTO notification_deliveries(
        id, occurrence_id, scheduled_at_utc, status, attempts, created_at_utc, updated_at_utc
      ) VALUES (?, ?, ?, 'pending', 1, ?, ?)
      ON CONFLICT(occurrence_id, scheduled_at_utc) DO UPDATE SET
        status = 'pending', attempts = attempts + 1, error_message = NULL, updated_at_utc = excluded.updated_at_utc
    `).run(deliveryId, row.id, row.effective_reminder_at_utc, now.toISOString(), now.toISOString());

    const todo = new TodoRepository(this.options.database).get(row.todo_id);
    if (!todo) return;
    const occurrence: Occurrence = {
      id: row.id,
      todoId: row.todo_id,
      scheduledAtUtc: row.scheduled_at_utc,
      reminderAtUtc: row.reminder_at_utc,
      state: row.state,
      deliveredAtUtc: row.delivered_at_utc,
      completedAtUtc: row.completed_at_utc,
      snoozedUntilUtc: row.snoozed_until_utc,
    };
    try {
      await this.options.notifier.send({ todo, occurrence, missed: scheduled.getTime() < now.getTime() - 60_000 });
      const deliveredAt = this.now().toISOString();
      this.options.database.prepare(`
        UPDATE occurrences
        SET state = 'delivered', delivered_at_utc = ?, claim_token = NULL, updated_at_utc = ?
        WHERE id = ? AND claim_token = ?
      `).run(deliveredAt, deliveredAt, row.id, claimToken);
      this.options.database.prepare(`
        UPDATE notification_deliveries
        SET status = 'delivered', delivered_at_utc = ?, updated_at_utc = ?
        WHERE occurrence_id = ? AND scheduled_at_utc = ?
      `).run(deliveredAt, deliveredAt, row.id, row.effective_reminder_at_utc);
    } catch (error) {
      const retryAt = new Date(this.now().getTime() + this.retryDelayMs).toISOString();
      this.options.database.prepare(`
        UPDATE occurrences
        SET state = 'scheduled', reminder_at_utc = ?, snoozed_until_utc = NULL,
            claim_token = NULL, claimed_at_utc = NULL, updated_at_utc = ?
        WHERE id = ? AND claim_token = ?
      `).run(retryAt, this.now().toISOString(), row.id, claimToken);
      this.options.database.prepare(`
        UPDATE notification_deliveries
        SET status = 'failed', error_message = ?, updated_at_utc = ?
        WHERE occurrence_id = ? AND scheduled_at_utc = ?
      `).run(error instanceof Error ? error.message : "notification failed", this.now().toISOString(), row.id, row.effective_reminder_at_utc);
    }
  }
}
