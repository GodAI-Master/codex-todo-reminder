import { z } from "zod";

import { recurrenceToRRule } from "../domain/recurrence.js";
import type { CreateTodoInput, UpdateTodoInput } from "../domain/todo.js";

const dateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), "时间格式无效");
const nullableDateTime = dateTime.nullable();

export const recurrenceSchema = z.object({
  kind: z.enum(["daily", "weekdays", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(365).default(1),
});

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(300),
  notes: z.string().max(10_000).optional(),
  listId: z.string().uuid().nullable().optional(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
  dueAt: nullableDateTime.optional(),
  reminderAt: nullableDateTime.optional(),
  timezone: z.string().min(1).max(100).optional(),
  recurrence: recurrenceSchema.nullable().optional(),
}).strict();

export const updateTodoSchema = createTodoSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "至少需要修改一个字段",
);

export const snoozeSchema = z.object({
  minutes: z.number().int().min(1).max(7 * 24 * 60),
  now: dateTime.optional(),
}).strict();

export function normalizeCreateInput(
  input: z.infer<typeof createTodoSchema>,
  defaultTimezone: string,
) : CreateTodoInput {
  return {
    title: input.title,
    timezone: input.timezone ?? defaultTimezone,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.listId === undefined ? {} : { listId: input.listId }),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
    ...(input.dueAt === undefined ? {} : { dueAtUtc: input.dueAt === null ? null : new Date(input.dueAt).toISOString() }),
    ...(input.reminderAt === undefined ? {} : { reminderAtUtc: input.reminderAt === null ? null : new Date(input.reminderAt).toISOString() }),
    ...(input.recurrence === undefined ? {} : {
      recurrenceRule: input.recurrence === null ? null : recurrenceToRRule(input.recurrence),
    }),
  };
}

export function normalizeUpdateInput(
  input: z.infer<typeof updateTodoSchema>,
): UpdateTodoInput {
  return {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.listId === undefined ? {} : { listId: input.listId }),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
    ...(input.dueAt === undefined ? {} : { dueAtUtc: input.dueAt === null ? null : new Date(input.dueAt).toISOString() }),
    ...(input.reminderAt === undefined ? {} : { reminderAtUtc: input.reminderAt === null ? null : new Date(input.reminderAt).toISOString() }),
    ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
    ...(input.recurrence === undefined ? {} : {
      recurrenceRule: input.recurrence === null ? null : recurrenceToRRule(input.recurrence),
    }),
  };
}
