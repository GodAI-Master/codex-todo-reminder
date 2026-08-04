import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../server/app.js";

describe("todo API", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => app?.close());

  async function createApp() {
    app = await buildApp({ startScheduler: false, dataDir: ":memory:", timezone: "Asia/Shanghai" });
    return app;
  }

  it("creates updates completes restores and deletes a todo", async () => {
    const instance = await createApp();
    const created = await instance.inject({
      method: "POST",
      url: "/api/todos",
      payload: {
        title: "整理发布说明",
        priority: "high",
        dueAt: "2026-08-05T15:00:00+08:00",
        reminderAt: "2026-08-05T14:30:00+08:00",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      title: "整理发布说明",
      displayId: "TODO-0001",
      dueAtUtc: "2026-08-05T07:00:00.000Z",
    });
    const id = created.json().id as string;

    const updated = await instance.inject({
      method: "PATCH",
      url: `/api/todos/${id}`,
      payload: { notes: "发布前检查安装步骤" },
    });
    expect(updated.json().notes).toBe("发布前检查安装步骤");

    expect((await instance.inject({ method: "POST", url: `/api/todos/${id}/complete` })).json().status)
      .toBe("completed");
    expect((await instance.inject({ method: "POST", url: `/api/todos/${id}/restore` })).json().status)
      .toBe("open");
    expect((await instance.inject({ method: "DELETE", url: `/api/todos/${id}` })).statusCode).toBe(204);
    expect((await instance.inject({ method: "GET", url: `/api/todos/${id}` })).statusCode).toBe(404);
  });

  it("rejects invalid todo input with a stable error shape", async () => {
    const instance = await createApp();
    const response = await instance.inject({
      method: "POST",
      url: "/api/todos",
      payload: { title: "", priority: "impossible" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "INVALID_TODO" },
    });
  });

  it("snoozes a scheduled todo", async () => {
    const instance = await createApp();
    const created = await instance.inject({
      method: "POST",
      url: "/api/todos",
      payload: {
        title: "检查构建",
        dueAt: "2026-08-05T15:00:00+08:00",
        reminderAt: "2026-08-05T14:30:00+08:00",
      },
    });
    const id = created.json().id as string;
    const response = await instance.inject({
      method: "POST",
      url: `/api/todos/${id}/snooze`,
      payload: { minutes: 10, now: "2026-08-05T06:30:00.000Z" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().snoozedUntilUtc).toBe("2026-08-05T06:40:00.000Z");
  });
});
