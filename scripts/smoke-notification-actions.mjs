import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = await mkdtemp(path.join(os.tmpdir(), "codex-todo-action-"));
const baseUrl = "http://127.0.0.1:47832";
const server = spawn(process.execPath, [path.join(projectRoot, "dist", "server", "main.js")], {
  cwd: projectRoot,
  env: { ...process.env, CODEX_TODO_DATA_DIR: dataDir, CODEX_TODO_PORT: "47832", CODEX_TODO_DIAGNOSTICS: "1" },
  windowsHide: true,
  stdio: ["ignore", "ignore", "pipe"],
});
let serverError = "";
server.stderr.on("data", (chunk) => { serverError += String(chunk); });

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(serverError || "isolated todo service did not start");
}

async function runAction(uri) {
  await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", path.join(projectRoot, "scripts", "handle-todo-action.ps1"),
      "-Uri", uri, "-DataDir", dataDir, "-BaseUrl", baseUrl,
    ], { cwd: projectRoot, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += String(chunk); });
    child.once("error", reject);
    child.once("close", async (code) => {
      if (code === 0) { resolve(); return; }
      const actionLog = await readFile(path.join(dataDir, "logs", "notification-actions.log"), "utf8").catch(() => "");
      reject(new Error(error || actionLog || `action handler exited with ${code}`));
    });
  });
}

try {
  await waitForHealth();
  const token = JSON.parse(await readFile(path.join(dataDir, "config", "auth.json"), "utf8")).token;
  const headers = { authorization: `Bearer ${token}`, origin: baseUrl, "content-type": "application/json" };
  const create = async (title) => {
    const response = await fetch(`${baseUrl}/api/todos`, {
      method: "POST", headers,
      body: JSON.stringify({ title, dueAt: "2099-08-05T07:00:00.000Z", reminderAt: "2099-08-05T06:30:00.000Z" }),
    });
    if (!response.ok) throw new Error(`create failed: ${response.status}`);
    return response.json();
  };

  const completedTodo = await create("系统通知完成测试");
  await runAction(`codex-todo-reminder://complete/${completedTodo.id}`);
  const completedResponse = await fetch(`${baseUrl}/api/todos/${completedTodo.id}`, { headers });
  const completed = await completedResponse.json();

  const snoozedTodo = await create("系统通知延迟测试");
  const beforeSnooze = Date.now();
  await runAction(`codex-todo-reminder://snooze/${snoozedTodo.id}?minutes=10`);
  const database = new DatabaseSync(path.join(dataDir, "data", "todo.db"));
  const occurrence = database.prepare("SELECT state, snoozed_until_utc FROM occurrences WHERE todo_id = ?").get(snoozedTodo.id);
  database.close();
  const snoozeMinutes = Math.round((Date.parse(occurrence.snoozed_until_utc) - beforeSnooze) / 60_000);
  const log = await readFile(path.join(dataDir, "logs", "notification-actions.log"), "utf8");
  const report = {
    ok: completed.status === "completed" && occurrence.state === "snoozed" && snoozeMinutes === 10
      && log.includes("success action=complete") && log.includes("success action=snooze"),
    completedStatus: completed.status,
    snoozedState: occurrence.state,
    snoozeMinutes,
    actionLogRecorded: log.includes("success action=complete") && log.includes("success action=snooze"),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("close", resolve));
  }
  await rm(dataDir, { recursive: true, force: true });
}
