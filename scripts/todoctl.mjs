#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseArgs, todoPayload } from "./todoctl-lib.mjs";

const parsed = parseArgs(process.argv.slice(2));
const baseUrl = String(parsed.flags.url ?? process.env.CODEX_TODO_URL ?? "http://127.0.0.1:47831").replace(/\/$/, "");
const dataDir = process.env.CODEX_TODO_DATA_DIR
  ?? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "CodexTodoReminder");

async function token() {
  const auth = JSON.parse(await readFile(path.join(dataDir, "config", "auth.json"), "utf8"));
  if (typeof auth.token !== "string") throw new Error("本机授权文件无效，请重新运行安装程序");
  return auth.token;
}

async function request(route, init = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: {
      authorization: `Bearer ${await token()}`,
      ...(init.body ? { "content-type": "application/json; charset=utf-8" } : {}),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? `待办服务返回 ${response.status}`);
  return body;
}

function body(value) { return { body: JSON.stringify(value) }; }
function print(value) { process.stdout.write(`${JSON.stringify(value, null, parsed.flags.json ? 0 : 2)}\n`); }
function requireReference() {
  if (!parsed.reference || parsed.reference.startsWith("--")) throw new Error(`${parsed.command} requires TODO-0001 or a todo UUID`);
  return encodeURIComponent(parsed.reference);
}

async function run() {
  switch (parsed.command) {
    case "add":
      print(await request("/api/todos", { method: "POST", ...body(todoPayload(parsed.flags)) }));
      break;
    case "list": {
      const view = String(parsed.flags.view ?? parsed.reference ?? "today");
      print(await request(`/api/views/${encodeURIComponent(view)}`));
      break;
    }
    case "get":
      print(await request(`/api/todos/${requireReference()}`));
      break;
    case "update":
      print(await request(`/api/todos/${requireReference()}`, { method: "PATCH", ...body(todoPayload(parsed.flags, { partial: true })) }));
      break;
    case "complete":
      print(await request(`/api/todos/${requireReference()}/complete`, { method: "POST" }));
      break;
    case "restore":
      print(await request(`/api/todos/${requireReference()}/restore`, { method: "POST" }));
      break;
    case "snooze":
      print(await request(`/api/todos/${requireReference()}/snooze`, {
        method: "POST",
        ...body({ minutes: Number(parsed.flags.minutes ?? 10) }),
      }));
      break;
    case "delete":
      await request(`/api/todos/${requireReference()}`, { method: "DELETE" });
      print({ ok: true, deleted: parsed.reference });
      break;
    default:
      print({
        usage: [
          "todoctl add --title <标题> [--due <ISO时间>] [--remind <ISO时间>] [--priority high]",
          "todoctl list [--view today|inbox|upcoming|recurring|completed]",
          "todoctl update TODO-0001 [--title ...] [--due ...]",
          "todoctl complete TODO-0001",
          "todoctl snooze TODO-0001 --minutes 10",
          "todoctl delete TODO-0001",
        ],
      });
  }
}

run().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: { code: "TODOCTL_FAILED", message: error.message } })}\n`);
  process.exitCode = 1;
});
