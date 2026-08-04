export const TODO_PRIORITIES = ["none", "low", "medium", "high"] as const;
export type TodoPriority = typeof TODO_PRIORITIES[number];
export const TODO_STATUSES = ["open", "completed", "deleted"] as const;
export type TodoStatus = typeof TODO_STATUSES[number];

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

export type CreateTodoInput = {
  title: string;
  notes?: string;
  listId?: string | null;
  priority?: TodoPriority;
  dueAtUtc?: string | null;
  reminderAtUtc?: string | null;
  timezone: string;
  recurrenceRule?: string | null;
};

export type UpdateTodoInput = Partial<Omit<CreateTodoInput, "timezone">> & {
  timezone?: string;
};
