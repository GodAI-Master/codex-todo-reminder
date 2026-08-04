import { describe, expect, it } from "vitest";

import { buildToastOptions } from "../../server/notifications/windows-toast.js";

describe("Windows toast", () => {
  it("builds an actionable local reminder", () => {
    const options = buildToastOptions({
      todo: {
        id: "2f29209c-3f11-42b5-adb2-f415ef50242f",
        displayId: "TODO-0001",
        title: "检查发布",
        dueAtUtc: null,
      },
      occurrenceId: "d2d68fd8-78fe-49d8-8f2c-55fd66f20787",
    });

    expect(options).toMatchObject({
      title: "待办任务 · TODO-0001",
      message: "现在提醒 · 检查发布",
      appID: "CodexTodoReminder",
      completeUri: "codex-todo-reminder://complete/2f29209c-3f11-42b5-adb2-f415ef50242f",
      snoozeTenUri: "codex-todo-reminder://snooze/2f29209c-3f11-42b5-adb2-f415ef50242f?minutes=10",
      snoozeSixtyUri: "codex-todo-reminder://snooze/2f29209c-3f11-42b5-adb2-f415ef50242f?minutes=60",
    });
    expect(options.openUri).toContain("codex-todo-reminder://open/");
  });
});
