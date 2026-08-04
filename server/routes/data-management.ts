import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { ApiError } from "./errors.js";
import { BackupService } from "../services/backup-service.js";
import { ImportExportService } from "../services/import-export-service.js";
import type { AppConfig } from "../config.js";
import type { EventBus } from "../services/event-bus.js";

export function registerDataRoutes(
  app: FastifyInstance,
  database: DatabaseSync,
  config: AppConfig,
  events: EventBus,
): BackupService {
  const backups = new BackupService(database, config);
  const portable = new ImportExportService(database);
  app.get("/api/data/export", async () => portable.export());
  app.post("/api/data/import/preview", async (request) => portable.preview(request.body));
  app.post("/api/data/import", async (request) => {
    const result = portable.merge(request.body);
    events.emit({ type: "todo.changed" });
    return result;
  });
  app.get("/api/backups", async () => ({ items: backups.list() }));
  app.post("/api/backups", async (_request, reply) => reply.code(201).send({ name: await backups.create(true) }));
  app.post("/api/backups/:name/restore", async (request) => {
    const name = (request.params as { name: string }).name;
    try { backups.stageRestore(name); }
    catch (error) { throw new ApiError(400, "RESTORE_FAILED", error instanceof Error ? error.message : "Restore failed"); }
    setTimeout(() => process.exit(75), 350).unref();
    return { ok: true, restarting: true };
  });
  return backups;
}
