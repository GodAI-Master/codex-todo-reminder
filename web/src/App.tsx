import { useCallback, useEffect, useMemo, useState } from "react";

import { QuickAdd } from "./components/QuickAdd.js";
import { Sidebar } from "./components/Sidebar.js";
import { SettingsPage } from "./components/SettingsPage.js";
import { StatusBanner } from "./components/StatusBanner.js";
import { TodoEditor } from "./components/TodoEditor.js";
import { TodoItem } from "./components/TodoItem.js";
import { Icon, type IconName } from "./components/Icon.js";
import { useConnectionStatus } from "./hooks/useConnectionStatus.js";
import { api } from "./lib/api.js";
import type { Todo, TodoDraft, TodoList, TodoPriority, ViewId } from "./lib/types.js";

const VIEW_COPY: Record<ViewId, { eyebrow: string; title: string; empty: string; icon: IconName }> = {
  inbox: { eyebrow: "CAPTURE", title: "收集箱", empty: "这里很安静。先写下一件想做的事。", icon: "inbox" },
  today: { eyebrow: "FOCUS", title: "今天", empty: "今天没有必须完成的事项。", icon: "today" },
  upcoming: { eyebrow: "HORIZON", title: "即将到期", empty: "未来暂时没有安排。", icon: "upcoming" },
  recurring: { eyebrow: "RHYTHM", title: "重复任务", empty: "还没有建立固定节奏。", icon: "repeat" },
  completed: { eyebrow: "ARCHIVE", title: "已完成", empty: "完成的事项会安静地留在这里。", icon: "completed" },
  settings: { eyebrow: "LOCAL DATA", title: "设置与备份", empty: "", icon: "settings" },
};

export function App() {
  const [view, setView] = useState<ViewId>("today");
  const [items, setItems] = useState<Todo[]>([]);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [todayItems, setTodayItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<TodoPriority | "all">("all");
  const [editing, setEditing] = useState<Todo | null>(null);

  const load = useCallback(async () => {
    try {
      const currentRequest = view === "settings" ? Promise.resolve({ items: [] as Todo[] }) : api.view(view);
      const [current, today, listData] = await Promise.all([currentRequest, api.view("today"), api.lists()]);
      setItems(current.items);
      setTodayItems(today.items);
      setLists(listData.items);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取待办");
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => { setLoading(true); void load(); }, [load]);
  const connection = useConnectionStatus(load);

  const filtered = useMemo(() => items.filter((todo) => {
    const matchesQuery = !query || `${todo.title}\n${todo.notes}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matchesQuery && (priority === "all" || todo.priority === priority);
  }), [items, priority, query]);

  const overdue = todayItems.filter((todo) => todo.dueAtUtc && new Date(todo.dueAtUtc).getTime() < Date.now()).length;

  async function act(operation: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try { await operation(); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "操作失败"); }
    finally { setBusy(false); }
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} onChange={setView} />
      <main className="workspace">
        <StatusBanner status={connection} />
        <header className="page-header">
          <div className="page-title-block">
            <span className="page-title-icon"><Icon name={VIEW_COPY[view].icon} /></span>
            <div>
            <span className="eyebrow">{VIEW_COPY[view].eyebrow}</span>
            <h1>{VIEW_COPY[view].title}</h1>
            </div>
          </div>
          <div className="day-stats" aria-label="今日概览">
            <div><Icon name="today" /><strong>{todayItems.length}</strong><span>今日剩余</span></div>
            <div className={overdue ? "stat-alert" : ""}><Icon name="alert" /><strong>{overdue}</strong><span>已经逾期</span></div>
          </div>
        </header>

        {view === "settings" ? <SettingsPage onChanged={load} /> : <>
        <QuickAdd lists={lists} busy={busy} onAdd={async (draft) => act(() => api.create(draft))} />

        <div className="toolbar">
          <label className="search-box"><Icon name="search" /><input aria-label="搜索待办" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或备注" /></label>
          <select aria-label="按优先级筛选" value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority | "all")}>
            <option value="all">全部优先级</option><option value="high">高优先级</option><option value="medium">中优先级</option><option value="low">低优先级</option><option value="none">普通</option>
          </select>
          <span className="item-count">{filtered.length} 件</span>
        </div>

        {error && <div className="inline-error" role="alert">{error}</div>}
        <section className="todo-list" aria-live="polite">
          {loading ? (
            <div className="loading-stack"><i /><i /><i /></div>
          ) : filtered.length ? filtered.map((todo, index) => (
            <div className="stagger" style={{ "--order": index } as React.CSSProperties} key={todo.id}>
              <TodoItem
                todo={todo}
                lists={lists}
                onEdit={setEditing}
                onComplete={(item) => void act(() => api.complete(item.id))}
                onRestore={(item) => void act(() => api.restore(item.id))}
                onSnooze={(item, minutes) => void act(() => api.snooze(item.id, minutes))}
              />
            </div>
          )) : (
            <div className="empty-state"><span><Icon name="empty" /></span><h2>此刻无事</h2><p>{VIEW_COPY[view].empty}</p></div>
          )}
        </section>
        </>}
      </main>
      <TodoEditor
        todo={editing}
        lists={lists}
        onClose={() => setEditing(null)}
        onSave={async (id, draft) => act(() => api.update(id, draft))}
        onDelete={async (todo) => {
          await act(() => api.remove(todo.id));
          setEditing(null);
        }}
      />
    </div>
  );
}
