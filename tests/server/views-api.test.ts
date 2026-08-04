import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../server/app.js";

describe("todo views", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it("returns inbox today upcoming and completed views", async () => {
    app = await buildApp({ startScheduler: false, dataDir: ":memory:", timezone: "Asia/Shanghai" });
    const add = (title: string, dueAt?: string) => app!.inject({
      method: "POST",
      url: "/api/todos",
      payload: { title, ...(dueAt ? { dueAt } : {}) },
    });
    await add("收集想法");
    const today = await add("今天完成", "2026-08-04T18:00:00+08:00");
    await add("未来任务", "2026-08-06T09:00:00+08:00");
    await app.inject({ method: "POST", url: `/api/todos/${today.json().id as string}/complete` });

    const inbox = await app.inject({ method: "GET", url: "/api/views/inbox" });
    const upcoming = await app.inject({ method: "GET", url: "/api/views/upcoming?now=2026-08-04T00:00:00.000Z" });
    const completed = await app.inject({ method: "GET", url: "/api/views/completed" });

    expect(inbox.json().items.map((item: { title: string }) => item.title)).toEqual(["收集想法"]);
    expect(upcoming.json().items.map((item: { title: string }) => item.title)).toContain("未来任务");
    expect(completed.json().items.map((item: { title: string }) => item.title)).toContain("今天完成");
  });
});
