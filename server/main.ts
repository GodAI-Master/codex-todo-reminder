import { buildApp } from "./app.js";
import { resolveConfig } from "./config.js";
import { applyPendingRestore } from "./services/backup-service.js";

const config = resolveConfig();
applyPendingRestore(config);
const app = await buildApp();

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.host, port: config.port });
