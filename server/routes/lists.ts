import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { ListRepository } from "../repositories/list-repository.js";
import type { EventBus } from "../services/event-bus.js";

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色必须是六位十六进制值");
const createSchema = z.object({ name: z.string().trim().min(1).max(80), color: color.optional() }).strict();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: color.optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}).strict();

export function registerListRoutes(app: FastifyInstance, database: DatabaseSync, events?: EventBus): void {
  const lists = new ListRepository(database);
  app.get("/api/lists", async () => ({ items: lists.list() }));
  app.post("/api/lists", async (request, reply) => {
    const list = lists.create(createSchema.parse(request.body));
    events?.emit({ type: "list.changed", id: list.id });
    return reply.code(201).send(list);
  });
  app.patch("/api/lists/:id", async (request) => {
    const list = lists.update((request.params as { id: string }).id, updateSchema.parse(request.body));
    events?.emit({ type: "list.changed", id: list.id });
    return list;
  });
}
