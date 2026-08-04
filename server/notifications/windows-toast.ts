import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ReminderNotifier, ReminderNotification } from "./notifier.js";

type ToastSource = {
  todo: Pick<ReminderNotification["todo"], "id" | "displayId" | "title" | "dueAtUtc">;
  occurrenceId: string;
  missed?: boolean;
};

function actionUri(action: "open" | "complete" | "snooze", todoId: string, minutes?: number): string {
  return `codex-todo-reminder://${action}/${encodeURIComponent(todoId)}${minutes ? `?minutes=${minutes}` : ""}`;
}

export function buildToastOptions(source: ToastSource) {
  const due = source.todo.dueAtUtc
    ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(source.todo.dueAtUtc))
    : "";
  const context = source.missed ? "恢复后补发" : due ? `${due} 到期` : "现在提醒";
  return {
    title: `待办任务 · ${source.todo.displayId}`,
    message: `${context} · ${source.todo.title}`,
    appID: "CodexTodoReminder",
    openUri: actionUri("open", source.todo.id),
    completeUri: actionUri("complete", source.todo.id),
    snoozeTenUri: actionUri("snooze", source.todo.id, 10),
    snoozeSixtyUri: actionUri("snooze", source.todo.id, 60),
  };
}

function notificationScript(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = currentDir.includes(`${path.sep}dist${path.sep}`)
    ? path.resolve(currentDir, "../../..")
    : path.resolve(currentDir, "../..");
  return path.join(projectRoot, "scripts", "show-todo-notification.ps1");
}

export class WindowsToastNotifier implements ReminderNotifier {
  async send(notification: ReminderNotification): Promise<void> {
    const options = buildToastOptions({
      todo: notification.todo,
      occurrenceId: notification.occurrence.id,
      missed: notification.missed,
    });
    await new Promise<void>((resolve, reject) => {
      const child = spawn("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
        "-File", notificationScript(),
        "-AppId", options.appID,
        "-Title", options.title,
        "-Message", options.message,
        "-OpenUri", options.openUri,
        "-CompleteLabel", "完成",
        "-SnoozeTenLabel", "10 分钟后",
        "-SnoozeSixtyLabel", "1 小时后",
        "-CompleteUri", options.completeUri,
        "-SnoozeTenUri", options.snoozeTenUri,
        "-SnoozeSixtyUri", options.snoozeSixtyUri,
      ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      let errorOutput = "";
      child.stderr?.on("data", (chunk) => { errorOutput += String(chunk); });
      child.once("error", reject);
      child.once("close", (code) => code === 0
        ? resolve()
        : reject(new Error(errorOutput.trim() || `Windows notification exited with code ${code}`)));
    });
  }
}
