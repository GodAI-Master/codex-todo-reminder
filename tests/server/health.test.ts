import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../server/app.js";

describe("health", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("reports the local service as healthy", async () => {
    app = await buildApp({ startScheduler: false, dataDir: ":memory:" });
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: "codex-todo-reminder",
    });
  });
});
