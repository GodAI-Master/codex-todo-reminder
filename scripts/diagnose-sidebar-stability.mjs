import { evaluate, listCodexTargets } from "./codex-cdp-client.mjs";

const portIndex = process.argv.indexOf("--port");
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 9231);
const durationIndex = process.argv.indexOf("--duration");
const duration = Number(durationIndex >= 0 ? process.argv[durationIndex + 1] : 1_200);
const warmupIndex = process.argv.indexOf("--warmup");
const warmup = Number(warmupIndex >= 0 ? process.argv[warmupIndex + 1] : 1_500);
const targets = await listCodexTargets(`http://127.0.0.1:${port}`);
if (!targets.length) throw new Error("No Codex window is connected.");
await new Promise((resolve) => setTimeout(resolve, warmup));

const report = await evaluate(targets[0], `(async () => {
  const ids = ["codex-taskboard-entry", "codex-todo-reminder-entry"];
  const sequences = [];
  const order = () => {
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const parent = nodes[0]?.parentElement;
    if (!parent || nodes.some((node) => node.parentElement !== parent)) return "missing-or-split";
    return Array.from(parent.children).filter((node) => ids.includes(node.id)).map((node) => node.id).join(">");
  };
  let moves = 0;
  let previous = order();
  sequences.push(previous);
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "childList" && (
      Array.from(record.addedNodes).some((node) => ids.includes(node.id))
      || Array.from(record.removedNodes).some((node) => ids.includes(node.id))
    ))) moves += 1;
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const timer = setInterval(() => {
    const current = order();
    if (current !== previous) { sequences.push(current); previous = current; }
  }, 20);
  await new Promise((resolve) => setTimeout(resolve, ${duration}));
  clearInterval(timer);
  observer.disconnect();
  return {
    stable: moves === 0 && sequences.length === 1,
    moves,
    sequences,
    finalOrder: order(),
    taskboardPresent: Boolean(document.getElementById(ids[0])),
    todoPresent: Boolean(document.getElementById(ids[1])),
  };
})()`, { timeoutMs: duration + 5_000 });

console.log(JSON.stringify(report, null, 2));
if (!report?.stable) process.exitCode = 1;
