import nodeNotifier from "node-notifier";

import type { ReminderNotifier, ReminderNotification } from "./notifier.js";

export type ToastAction =
  | { action: "complete" }
  | { action: "snooze"; minutes: number }
  | { action: "open" };

type ToastSource = {
  todo: Pick<ReminderNotification["todo"], "id" | "displayId" | "title" | "dueAtUtc">;
  occurrenceId: string;
  missed?: boolean;
};

export function buildToastOptions(source: ToastSource) {
  const due = source.todo.dueAtUtc
    ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(source.todo.dueAtUtc))
    : "";
  const context = source.missed ? "恢复后补发" : due ? `${due} 到期` : "现在提醒";
  return {
    title: `待办任务 · ${source.todo.displayId}`,
    message: `${context} · ${source.todo.title}`,
    appID: "CodexTodoReminder",
    sound: true,
    wait: true,
    timeout: 30,
    actions: ["完成", "10 分钟后", "1 小时后"],
  };
}

export function mapToastAction(response: string): ToastAction {
  if (response === "完成") return { action: "complete" };
  if (response === "10 分钟后") return { action: "snooze", minutes: 10 };
  if (response === "1 小时后") return { action: "snooze", minutes: 60 };
  return { action: "open" };
}

export class WindowsToastNotifier implements ReminderNotifier {
  constructor(
    private readonly onAction?: (notification: ReminderNotification, action: ToastAction) => void | Promise<void>,
  ) {}

  async send(notification: ReminderNotification): Promise<void> {
    const WindowsToaster = nodeNotifier.WindowsToaster as unknown as new (options: { withFallback: boolean }) => {
      notify(options: object, callback: (error: Error | null, response: string) => void): void;
    };
    const toaster = new WindowsToaster({ withFallback: false });
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      toaster.notify(buildToastOptions({
        todo: notification.todo,
        occurrenceId: notification.occurrence.id,
        missed: notification.missed,
      }), (error, response) => {
        if (error && !settled) { settled = true; reject(error); return; }
        if (this.onAction) void this.onAction(notification, mapToastAction(response));
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve();
      }, 250);
    });
  }
}
