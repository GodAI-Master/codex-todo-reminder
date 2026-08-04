import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type AppConfig = {
  host: string;
  port: number;
  dataDir: string;
  databasePath: string;
  backupDir: string;
  logDir: string;
  configDir: string;
  authFile: string;
  timezone: string;
};

export type ConfigOverrides = Partial<Pick<AppConfig, "host" | "port" | "dataDir" | "timezone">>;

export function resolveConfig(overrides: ConfigOverrides = {}): AppConfig {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const dataDir = overrides.dataDir
    ?? process.env.CODEX_TODO_DATA_DIR
    ?? path.join(localAppData, "CodexTodoReminder");
  const inMemory = dataDir === ":memory:";
  const config: AppConfig = {
    host: overrides.host ?? process.env.CODEX_TODO_HOST ?? "127.0.0.1",
    port: overrides.port ?? Number(process.env.CODEX_TODO_PORT ?? 47831),
    dataDir,
    databasePath: inMemory ? ":memory:" : path.join(dataDir, "data", "todo.db"),
    backupDir: inMemory ? ":memory:" : path.join(dataDir, "backups"),
    logDir: inMemory ? ":memory:" : path.join(dataDir, "logs"),
    configDir: inMemory ? ":memory:" : path.join(dataDir, "config"),
    authFile: inMemory ? ":memory:" : path.join(dataDir, "config", "auth.json"),
    timezone: overrides.timezone ?? process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Shanghai",
  };

  if (!Number.isSafeInteger(config.port) || config.port < 1024 || config.port > 65535) {
    throw new Error("CODEX_TODO_PORT must be an integer between 1024 and 65535");
  }
  if (config.host !== "127.0.0.1" && config.host !== "::1") {
    throw new Error("Codex Todo Reminder may only bind to a loopback address");
  }
  if (!inMemory) {
    mkdirSync(path.dirname(config.databasePath), { recursive: true });
    mkdirSync(config.backupDir, { recursive: true });
    mkdirSync(config.logDir, { recursive: true });
    mkdirSync(config.configDir, { recursive: true });
  }
  return config;
}
