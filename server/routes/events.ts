import type { FastifyInstance } from "fastify";

import type { EventBus } from "../services/event-bus.js";

export function registerEventRoutes(app: FastifyInstance, events: EventBus): void {
  app.get("/api/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    const unsubscribe = events.subscribe((event) => {
      if (!reply.raw.destroyed) reply.raw.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const keepAlive = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(": keepalive\n\n");
    }, 20_000);
    keepAlive.unref();
    request.raw.once("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });
}
