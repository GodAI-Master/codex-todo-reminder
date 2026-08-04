// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuickAdd } from "../../web/src/components/QuickAdd.js";
import { Sidebar } from "../../web/src/components/Sidebar.js";

describe("todo panel shell", () => {
  it("shows every core view", () => {
    render(<Sidebar view="today" onChange={() => undefined} />);
    for (const label of ["收集箱", "今天", "即将到期", "重复任务", "已完成"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("quickly captures a todo", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<QuickAdd lists={[]} onAdd={onAdd} busy={false} />);
    await user.type(screen.getByLabelText("快速新增待办"), "整理项目总结");
    await user.click(screen.getByRole("button", { name: "加入" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "整理项目总结" }));
  });
});
