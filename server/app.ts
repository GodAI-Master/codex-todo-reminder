import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveConfig, type ConfigOverrides } from "./config.js";
import { createDatabase } from "./db/database.js";
import { WindowsToastNotifier } from "./notifications/windows-toast.js";
import { registerErrorHandler } from "./routes/errors.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerListRoutes } from "./routes/lists.js";
import { registerTodoRoutes } from "./routes/todos.js";
import { registerViewRoutes } from "./routes/views.js";
import { EventBus } from "./services/event-bus.js";
import { ReminderScheduler } from "./services/reminder-scheduler.js";
import { loadOrCreateLocalAuth, tokenMatches } from "./security/local-auth.js";
import { isTrustedOrigin } from "./security/origin-policy.js";
import { ApiError } from "./routes/errors.js";
import { registerDataRoutes } from "./routes/data-management.js";

export type BuildAppOptions = ConfigOverrides & {
  startScheduler?: boolean;
  authEnabled?: boolean;
  authToken?: string;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = resolveConfig(options);
  const database = createDatabase(config.databasePath);
  const app = Fastify({ logger: false });
  const events = new EventBus();
  const authEnabled = options.authEnabled ?? (config.databasePath !== ":memory:" && process.env.CODEX_TODO_AUTH_DISABLED !== "1");
  const localAuth = loadOrCreateLocalAuth(config.authFile, options.authToken);

  app.decorate("todoConfig", config);
  app.decorate("todoDatabase", database.raw);
  app.addHook("onClose", async () => database.close());

  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/api/")) return;
    if (!isTrustedOrigin(request.headers.origin)) {
      throw new ApiError(403, "UNTRUSTED_ORIGIN", "请求来源不受信任");
    }
    if (!authEnabled) return;
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const queryToken = request.url.startsWith("/api/events")
      ? String((request.query as { token?: string }).token ?? "")
      : "";
    if (!tokenMatches(localAuth.token, bearer || queryToken)) {
      throw new ApiError(401, "LOCAL_AUTH_REQUIRED", "本机授权无效，请通过 Codex 面板重新打开");
    }
  });

  registerErrorHandler(app);
  registerTodoRoutes(app, database.raw, config.timezone, events);
  registerListRoutes(app, database.raw, events);
  registerViewRoutes(app, database.raw, config.timezone);
  registerEventRoutes(app, events);
  const backups = registerDataRoutes(app, database.raw, config, events);

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const webRoot = currentDir.includes(`${path.sep}dist${path.sep}`)
    ? path.resolve(currentDir, "../web")
    : path.resolve(currentDir, "../dist/web");
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: "/panel/",
      decorateReply: false,
    });
    app.get("/panel", async (_request, reply) => reply.redirect("/panel/"));
  }

  app.get("/health", async () => ({
    ok: true,
    service: "codex-todo-reminder",
    version: "0.1.5",
    scheduler: options.startScheduler === false ? "disabled" : "ready",
    now: new Date().toISOString(),
  }));

  if (options.startScheduler !== false) {
    const scheduler = new ReminderScheduler({
      database: database.raw,
      notifier: new WindowsToastNotifier(),
    });
    scheduler.start();
    app.addHook("onClose", async () => scheduler.stop());
    setTimeout(() => void backups.create(false).catch((error) => app.log.error(error)), 1_000).unref();
  }

  return app;
}
