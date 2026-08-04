import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveConfig, type ConfigOverrides } from "./config.js";
import { createDatabase } from "./db/database.js";
import { WindowsToastNotifier, type ToastAction } from "./notifications/windows-toast.js";
import { TodoRepository } from "./repositories/todo-repository.js";
import { registerErrorHandler } from "./routes/errors.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerListRoutes } from "./routes/lists.js";
import { registerTodoRoutes } from "./routes/todos.js";
import { registerViewRoutes } from "./routes/views.js";
import { OccurrenceService } from "./services/occurrence-service.js";
import { EventBus } from "./services/event-bus.js";
import { ReminderScheduler } from "./services/reminder-scheduler.js";
import { loadOrCreateLocalAuth, tokenMatches } from "./security/local-auth.js";
import { isTrustedOrigin } from "./security/origin-policy.js";
import { ApiError } from "./routes/errors.js";
import { registerDataRoutes } from "./routes/data-management.js";
import { completeTodo, snoozeTodo } from "./services/todo-actions.js";

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
  const projectRoot = currentDir.includes(`${path.sep}dist${path.sep}`)
    ? path.resolve(currentDir, "../..")
    : path.resolve(currentDir, "..");
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
    version: "0.1.2",
    scheduler: options.startScheduler === false ? "disabled" : "ready",
    now: new Date().toISOString(),
  }));

  if (options.startScheduler !== false) {
    const actionHandler = async (
      notification: Parameters<WindowsToastNotifier["send"]>[0],
      action: ToastAction,
    ) => {
      if (action.action === "complete") {
        completeTodo(database.raw, notification.todo.id, events);
      } else if (action.action === "snooze") {
        snoozeTodo(database.raw, notification.todo.id, action.minutes, events);
      } else {
        const launcher = path.join(projectRoot, "scripts", "start-codex-todo-windows.ps1");
        const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcher], {
          cwd: projectRoot,
          detached: true,
          windowsHide: true,
          stdio: "ignore",
        });
        child.unref();
      }
    };
    const scheduler = new ReminderScheduler({
      database: database.raw,
      notifier: new WindowsToastNotifier(actionHandler),
    });
    scheduler.start();
    app.addHook("onClose", async () => scheduler.stop());
    setTimeout(() => void backups.create(false).catch((error) => app.log.error(error)), 1_000).unref();
  }

  return app;
}
