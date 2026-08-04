CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  todo_number INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  notes TEXT NOT NULL DEFAULT '',
  list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'deleted')),
  due_at_utc TEXT,
  reminder_at_utc TEXT,
  timezone TEXT NOT NULL,
  recurrence_rule TEXT,
  completed_at_utc TEXT,
  deleted_at_utc TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS todos_status_due_idx ON todos(status, due_at_utc);
CREATE INDEX IF NOT EXISTS todos_list_idx ON todos(list_id, status);

CREATE TABLE IF NOT EXISTS occurrences (
  id TEXT PRIMARY KEY,
  todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  scheduled_at_utc TEXT NOT NULL,
  reminder_at_utc TEXT,
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'claimed', 'delivered', 'completed', 'snoozed', 'skipped')),
  claim_token TEXT,
  claimed_at_utc TEXT,
  delivered_at_utc TEXT,
  completed_at_utc TEXT,
  snoozed_until_utc TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS occurrences_todo_scheduled_unique
  ON occurrences(todo_id, scheduled_at_utc);
CREATE INDEX IF NOT EXISTS occurrences_reminder_state_idx
  ON occurrences(state, reminder_at_utc);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  scheduled_at_utc TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  delivered_at_utc TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  UNIQUE(occurrence_id, scheduled_at_utc)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

INSERT OR IGNORE INTO settings(key, value_json, updated_at_utc)
VALUES ('schema_defaults', '{"missedReminderWindowMinutes":1440,"backupRetentionDays":14}', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
