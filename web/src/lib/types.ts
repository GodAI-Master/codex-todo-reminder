export type TodoPriority = "none" | "low" | "medium" | "high";
export type TodoStatus = "open" | "completed" | "deleted";

export type Todo = {
  id: string;
  displayId: string;
  title: string;
  notes: string;
  listId: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  dueAtUtc: string | null;
  reminderAtUtc: string | null;
  timezone: string;
  recurrenceRule: string | null;
  completedAtUtc: string | null;
  deletedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type TodoList = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  archived: boolean;
};

export type ViewId = "inbox" | "today" | "upcoming" | "recurring" | "completed" | "settings";

export type BackupItem = {
  name: string;
  size: number;
  modifiedAtUtc: string;
};

export type TodoDraft = {
  title: string;
  notes?: string;
  listId?: string | null;
  priority?: TodoPriority;
  dueAt?: string | null;
  reminderAt?: string | null;
  recurrence?: null | {
    kind: "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
    interval: number;
  };
};
