import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../server/app.js";

describe("local API security", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it("requires the local bearer token", async () => {
    app = await buildApp({ dataDir: ":memory:", startScheduler: false, authEnabled: true, authToken: "a".repeat(43) });
    expect((await app.inject({ method: "GET", url: "/api/views/inbox" })).statusCode).toBe(401);
    expect((await app.inject({
      method: "GET",
      url: "/api/views/inbox",
      headers: { authorization: `Bearer ${"a".repeat(43)}` },
    })).statusCode).toBe(200);
  });

  it("rejects external browser origins even with a valid token", async () => {
    app = await buildApp({ dataDir: ":memory:", startScheduler: false, authEnabled: true, authToken: "b".repeat(43) });
    const response = await app.inject({
      method: "GET",
      url: "/api/views/inbox",
      headers: { authorization: `Bearer ${"b".repeat(43)}`, origin: "https://evil.example" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "UNTRUSTED_ORIGIN" } });
  });
});
