import { useState, type FormEvent } from "react";

import type { TodoDraft, TodoList, TodoPriority } from "../lib/types.js";

export function QuickAdd({ lists, onAdd, busy }: {
  lists: TodoList[];
  onAdd: (draft: TodoDraft) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("none");
  const [listId, setListId] = useState("");
  const [expanded, setExpanded] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    await onAdd({
      title: clean,
      priority,
      ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      ...(listId ? { listId } : {}),
    });
    setTitle("");
    setDueAt("");
    setPriority("none");
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-main">
        <span className="quick-plus" aria-hidden="true">＋</span>
        <input
          aria-label="快速新增待办"
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder="写下下一件要做的事…"
          value={title}
        />
        <button className="add-button" disabled={busy || !title.trim()} type="submit">加入</button>
      </div>
      {expanded && (
        <div className="quick-options">
          <label>
            <span>截止时间</span>
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>
          <label>
            <span>优先级</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority)}>
              <option value="none">普通</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>
          <label>
            <span>清单</span>
            <select value={listId} onChange={(event) => setListId(event.target.value)}>
              <option value="">无清单</option>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </label>
        </div>
      )}
    </form>
  );
}
