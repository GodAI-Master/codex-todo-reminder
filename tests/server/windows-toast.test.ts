import { describe, expect, it, vi } from "vitest";

import { buildToastOptions, mapToastAction } from "../../server/notifications/windows-toast.js";

describe("Windows toast", () => {
  it("builds an actionable local reminder", () => {
    const options = buildToastOptions({
      todo: {
        id: "2f29209c-3f11-42b5-adb2-f415ef50242f",
        displayId: "TODO-0001",
        title: "检查发布",
      },
      occurrenceId: "d2d68fd8-78fe-49d8-8f2c-55fd66f20787",
    });

    expect(options).toMatchObject({
      title: "待办任务 · TODO-0001",
      message: "检查发布",
      appID: "CodexTodoReminder",
      wait: true,
    });
    expect(options.actions).toEqual(["完成", "10 分钟后", "1 小时后"]);
  });

  it("maps only supported notification actions", () => {
    expect(mapToastAction("完成")).toEqual({ action: "complete" });
    expect(mapToastAction("10 分钟后")).toEqual({ action: "snooze", minutes: 10 });
    expect(mapToastAction("unknown")).toEqual({ action: "open" });
  });
});
