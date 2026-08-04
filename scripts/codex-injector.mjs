import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CdpConnection, listCodexTargets } from "./codex-cdp-client.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const inline = args.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const port = Number(readArg("--port", process.env.CODEX_CDP_PORT ?? "9231"));
const origin = `http://127.0.0.1:${port}`;
const watch = args.includes("--watch");
const open = args.includes("--open");
const dataDir = process.env.CODEX_TODO_DATA_DIR
  ?? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "CodexTodoReminder");
const source = await readFile(path.join(projectRoot, "inject", "codex-todo.user.js"), "utf8");
const sourceHash = createHash("sha256").update(source).digest("hex").slice(0, 16);
const connections = new Map();

async function expression() {
  const auth = JSON.parse(await readFile(path.join(dataDir, "config", "auth.json"), "utf8"));
  const panel = new URL(process.env.CODEX_TODO_PANEL_URL ?? "http://127.0.0.1:47831/panel/");
  panel.hash = new URLSearchParams({ token: auth.token }).toString();
  return `window.__CODEX_TODO_URL__=${JSON.stringify(panel.href)};window.__CODEX_TODO_SOURCE_HASH__=${JSON.stringify(sourceHash)};window.__CODEX_TODO_OPEN_ON_INJECT__=${open};\n${source}`;
}

async function reloadWithBypass(connection) {
  await connection.send("Page.reload");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      const ready = await connection.evaluate("document.readyState");
      if (ready === "interactive" || ready === "complete") return;
    } catch {
      // The old execution context is expected to disappear during reload.
    }
  }
  throw new Error("Codex did not finish reloading after enabling local panel access");
}

async function injectOnce() {
  const targets = await listCodexTargets(origin);
  const activeIds = new Set(targets.map((target) => target.id));
  for (const [id, connection] of connections) {
    if (!activeIds.has(id)) { connection.close(); connections.delete(id); }
  }
  if (targets.length === 0) return 0;
  const script = await expression();
  for (const target of targets) {
    let connection = connections.get(target.id);
    if (!connection || connection.closed || connection.target.webSocketDebuggerUrl !== target.webSocketDebuggerUrl) {
      connection?.close();
      connection = new CdpConnection(target, { bypassCSP: true });
      await connection.open();
      await reloadWithBypass(connection);
      connections.set(target.id, connection);
    }
    try { await connection.evaluate(script); }
    catch (error) { connection.close(); connections.delete(target.id); throw error; }
  }
  return targets.length;
}

let lastState = "";
do {
  try {
    const count = await injectOnce();
    const state = count ? `Injected ${count} Codex window(s).` : "Waiting for Codex.";
    if (state !== lastState) console.log(state);
    lastState = state;
  } catch (error) {
    const state = `Waiting: ${error.message}`;
    if (state !== lastState) console.log(state);
    lastState = state;
    if (!watch) process.exitCode = 1;
  }
  if (watch) await new Promise((resolve) => setTimeout(resolve, 2_000));
} while (watch);

if (!watch) for (const connection of connections.values()) connection.close();
