import { useEffect, useState, type FormEvent } from "react";

import type { Todo, TodoDraft, TodoList, TodoPriority } from "../lib/types.js";
import { Icon } from "./Icon.js";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function TodoEditor({ todo, lists, onClose, onSave, onDelete }: {
  todo: Todo | null;
  lists: TodoList[];
  onClose: () => void;
  onSave: (id: string, draft: Partial<TodoDraft>) => Promise<void>;
  onDelete: (todo: Todo) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("none");
  const [listId, setListId] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title);
    setNotes(todo.notes);
    setDueAt(toLocalInput(todo.dueAtUtc));
    setReminderAt(toLocalInput(todo.reminderAtUtc));
    setPriority(todo.priority);
    setListId(todo.listId ?? "");
    if (!todo.recurrenceRule) setRecurrence("");
    else if (todo.recurrenceRule.includes("BYDAY=MO,TU,WE,TH,FR")) setRecurrence("weekdays");
    else if (todo.recurrenceRule.includes("FREQ=DAILY")) setRecurrence("daily");
    else if (todo.recurrenceRule.includes("FREQ=WEEKLY")) setRecurrence("weekly");
    else if (todo.recurrenceRule.includes("FREQ=MONTHLY")) setRecurrence("monthly");
    else setRecurrence("yearly");
  }, [todo]);

  if (!todo) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave(todo!.id, {
        title: title.trim(),
        notes,
        listId: listId || null,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
        recurrence: recurrence ? { kind: recurrence as "daily" | "weekdays" | "weekly" | "monthly" | "yearly", interval: 1 } : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="editor-panel" role="dialog" aria-modal="true" aria-label="编辑待办">
        <header>
          <div><small>{todo.displayId}</small><h2>整理这件事</h2></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="关闭"><Icon name="close" /></button>
        </header>
        <form onSubmit={submit}>
          <label className="field wide"><span>标题</span><input required maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="field wide"><span>备注</span><textarea rows={4} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className="field-grid">
            <label className="field"><span>截止时间</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
            <label className="field"><span>提醒时间</span><input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} /></label>
            <label className="field"><span>优先级</span><select value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority)}><option value="none">普通</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
            <label className="field"><span>清单</span><select value={listId} onChange={(event) => setListId(event.target.value)}><option value="">无清单</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
            <label className="field wide"><span>重复</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="">不重复</option><option value="daily">每天</option><option value="weekdays">每个工作日</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="yearly">每年</option></select></label>
          </div>
          <footer>
            <button className="danger-link" type="button" onClick={() => void onDelete(todo)}>移到回收站</button>
            <div><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" disabled={busy || !title.trim()} type="submit">保存修改</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
