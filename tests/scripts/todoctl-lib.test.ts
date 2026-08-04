import { describe, expect, it } from "vitest";

// The CLI helper is intentionally plain JavaScript so it can run without a build step.
// @ts-expect-error JavaScript CLI helper has no generated declaration file.
import { parseArgs, todoPayload } from "../../scripts/todoctl-lib.mjs";

describe("todoctl argument handling", () => {
  it("accepts flags immediately after the command", () => {
    expect(parseArgs(["add", "--title", "整理发布说明", "--priority", "high"])).toEqual({
      command: "add",
      reference: undefined,
      positionals: [],
      flags: { title: "整理发布说明", priority: "high" },
    });
  });

  it("builds a normalized API payload", () => {
    expect(todoPayload({ title: "提交周报", due: "2026-08-07T17:00:00+08:00", repeat: "weekly" })).toEqual({
      title: "提交周报",
      dueAt: "2026-08-07T09:00:00.000Z",
      recurrence: { kind: "weekly", interval: 1 },
    });
  });
});
