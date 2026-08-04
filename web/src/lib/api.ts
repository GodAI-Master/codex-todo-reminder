import type { BackupItem, Todo, TodoDraft, TodoList, ViewId } from "./types.js";

const SESSION_TOKEN_KEY = "codex-todo-reminder-token";

function captureToken(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("token");
  if (token) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return token;
  }
  return sessionStorage.getItem(SESSION_TOKEN_KEY) ?? "";
}

export const localToken = captureToken();

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (localToken) headers.set("authorization", `Bearer ${localToken}`);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `请求失败 (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  view: (view: ViewId) => request<{ items: Todo[] }>(`/api/views/${view}`),
  lists: () => request<{ items: TodoList[] }>("/api/lists"),
  create: (draft: TodoDraft) => request<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify(draft),
  }),
  update: (id: string, draft: Partial<TodoDraft>) => request<Todo>(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(draft),
  }),
  complete: (id: string) => request<Todo>(`/api/todos/${id}/complete`, { method: "POST" }),
  restore: (id: string) => request<Todo>(`/api/todos/${id}/restore`, { method: "POST" }),
  snooze: (id: string, minutes: number) => request(`/api/todos/${id}/snooze`, {
    method: "POST",
    body: JSON.stringify({ minutes }),
  }),
  remove: (id: string) => request<void>(`/api/todos/${id}`, { method: "DELETE" }),
  exportData: () => request<Record<string, unknown>>("/api/data/export"),
  importPreview: (data: unknown) => request<{ valid: true; lists: number; todos: number }>("/api/data/import/preview", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  importData: (data: unknown) => request<{ listsAdded: number; todosAdded: number; skipped: number }>("/api/data/import", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  backups: () => request<{ items: BackupItem[] }>("/api/backups"),
  createBackup: () => request<{ name: string }>("/api/backups", { method: "POST" }),
  restoreBackup: (name: string) => request<{ ok: true; restarting: true }>(`/api/backups/${encodeURIComponent(name)}/restore`, { method: "POST" }),
};
