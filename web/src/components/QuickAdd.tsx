import { useState, type FormEvent } from "react";

import type { TodoDraft, TodoList, TodoPriority } from "../lib/types.js";
import { Icon } from "./Icon.js";

export function QuickAdd({ lists, onAdd, busy }: {
  lists: TodoList[];
  onAdd: (draft: TodoDraft) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("none");
  const [listId, setListId] = useState("");
  const [reminderOffset, setReminderOffset] = useState("0");
  const [expanded, setExpanded] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const due = dueAt ? new Date(dueAt) : null;
    const reminder = due ? new Date(due.getTime() - Number(reminderOffset) * 60_000) : null;
    await onAdd({
      title: clean,
      priority,
      ...(due && reminder ? { dueAt: due.toISOString(), reminderAt: reminder.toISOString() } : {}),
      ...(listId ? { listId } : {}),
    });
    setTitle("");
    setDueAt("");
    setPriority("none");
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-main">
        <span className="quick-plus"><Icon name="plus" /></span>
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
            <span>提醒</span>
            <select disabled={!dueAt} value={reminderOffset} onChange={(event) => setReminderOffset(event.target.value)}>
              <option value="0">到期时</option>
              <option value="10">提前 10 分钟</option>
              <option value="60">提前 1 小时</option>
              <option value="1440">提前 1 天</option>
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
