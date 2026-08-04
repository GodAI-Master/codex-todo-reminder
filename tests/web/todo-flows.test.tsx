// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TodoItem } from "../../web/src/components/TodoItem.js";
import type { Todo } from "../../web/src/lib/types.js";

const todo: Todo = {
  id: "4cb24fde-02ae-4e9f-a693-82a85446e96f",
  displayId: "TODO-0001",
  title: "发布首个版本",
  notes: "安装前完整检查",
  listId: null,
  priority: "high",
  status: "open",
  dueAtUtc: "2099-08-05T07:00:00.000Z",
  reminderAtUtc: "2099-08-05T06:30:00.000Z",
  timezone: "Asia/Shanghai",
  recurrenceRule: null,
  completedAtUtc: null,
  deletedAtUtc: null,
  createdAtUtc: "2026-08-04T00:00:00.000Z",
  updatedAtUtc: "2026-08-04T00:00:00.000Z",
};

describe("todo item flows", () => {
  it("exposes complete snooze and edit actions", async () => {
    const onComplete = vi.fn();
    const onSnooze = vi.fn();
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<TodoItem todo={todo} lists={[]} onComplete={onComplete} onRestore={vi.fn()} onSnooze={onSnooze} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: `完成 ${todo.title}` }));
    await user.click(screen.getByRole("button", { name: "稍后" }));
    await user.click(screen.getByRole("button", { name: "编辑" }));

    expect(onComplete).toHaveBeenCalledWith(todo);
    expect(onSnooze).toHaveBeenCalledWith(todo);
    expect(onEdit).toHaveBeenCalledWith(todo);
  });
});
