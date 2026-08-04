// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAdd } from "../../web/src/components/QuickAdd.js";
import { Sidebar } from "../../web/src/components/Sidebar.js";

afterEach(cleanup);

describe("todo panel shell", () => {
  it("shows every core view", () => {
    render(<Sidebar view="today" onChange={() => undefined} />);
    for (const label of ["收集箱", "今天", "即将到期", "重复任务", "已完成", "设置与备份"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(document.querySelectorAll(".sidebar svg.icon")).toHaveLength(7);
  });

  it("quickly captures a todo", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<QuickAdd lists={[]} onAdd={onAdd} busy={false} />);
    await user.type(screen.getByLabelText("快速新增待办"), "整理项目总结");
    await user.click(screen.getByRole("button", { name: "加入" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "整理项目总结" }));
  });

  it("creates an advance reminder from quick add", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<QuickAdd lists={[]} onAdd={onAdd} busy={false} />);
    await user.type(screen.getByLabelText("快速新增待办"), "准备周会");
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2099-08-05T15:00" } });
    await user.selectOptions(screen.getByLabelText("提醒"), "60");
    await user.click(screen.getByRole("button", { name: "加入" }));

    const draft = onAdd.mock.calls[0]?.[0];
    expect(Date.parse(draft.dueAt) - Date.parse(draft.reminderAt)).toBe(60 * 60_000);
  });
});
