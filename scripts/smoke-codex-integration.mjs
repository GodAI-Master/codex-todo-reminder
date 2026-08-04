import { evaluate, listCodexTargets } from "./codex-cdp-client.mjs";

const portIndex = process.argv.indexOf("--port");
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 9231);
const origin = `http://127.0.0.1:${port}`;
const targets = await listCodexTargets(origin);
if (!targets.length) throw new Error("No Codex window is connected to the local panel bridge.");
const healthResponse = await fetch("http://127.0.0.1:47831/health", { signal: AbortSignal.timeout(2_000) });
const panelHealthy = healthResponse.ok && (await healthResponse.json()).ok === true;

const result = await evaluate(targets[0], `(async () => {
  const api = window.__CODEX_TODO_PANEL__;
  if (!api) return { ok: false, reason: "injector-missing" };
  api.open();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const entries = document.querySelectorAll("#codex-todo-reminder-entry");
  const frame = document.querySelector("#codex-todo-reminder-frame");
  return {
    ok: entries.length === 1 && Boolean(frame),
    entryCount: entries.length,
    panelVisible: Boolean(frame && !frame.hidden),
    panelUrl: frame?.src?.replace(/#.*$/, "#token=hidden") || null,
  };
})()`);

const report = { ...result, panelHealthy };
report.ok = Boolean(result?.ok && panelHealthy);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
