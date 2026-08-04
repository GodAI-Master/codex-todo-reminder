import type { Todo, TodoList } from "../lib/types.js";
import { Icon } from "./Icon.js";

const PRIORITY_LABEL = { none: "", low: "低", medium: "中", high: "高" } as const;

function dueLabel(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function TodoItem({ todo, lists, onComplete, onRestore, onEdit, onSnooze }: {
  todo: Todo;
  lists: TodoList[];
  onComplete: (todo: Todo) => void;
  onRestore: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onSnooze: (todo: Todo, minutes: number) => void;
}) {
  const list = lists.find((item) => item.id === todo.listId);
  const overdue = Boolean(todo.dueAtUtc && todo.status === "open" && new Date(todo.dueAtUtc).getTime() < Date.now());
  const tomorrowMorning = new Date();
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);
  const untilTomorrowMorning = Math.max(1, Math.ceil((tomorrowMorning.getTime() - Date.now()) / 60_000));
  return (
    <article className={`todo-card priority-${todo.priority} ${todo.status === "completed" ? "is-complete" : ""}`}>
      <button
        className="complete-toggle"
        aria-label={todo.status === "completed" ? `恢复 ${todo.title}` : `完成 ${todo.title}`}
        onClick={() => todo.status === "completed" ? onRestore(todo) : onComplete(todo)}
        type="button"
      >
        {todo.status === "completed" ? "✓" : ""}
      </button>
      <div className="todo-copy" onDoubleClick={() => onEdit(todo)}>
        <div className="todo-title-row">
          <h3>{todo.title}</h3>
          {todo.priority !== "none" && <span className={`priority-tag ${todo.priority}`}>{PRIORITY_LABEL[todo.priority]}</span>}
        </div>
        {todo.notes && <p>{todo.notes}</p>}
        <div className="todo-meta">
          <span className="display-id">{todo.displayId}</span>
          {todo.dueAtUtc && <span className={overdue ? "due overdue" : "due"}><Icon name={overdue ? "alert" : "clock"} />{overdue ? "已逾期 · " : ""}{dueLabel(todo.dueAtUtc)}</span>}
          {todo.reminderAtUtc && todo.reminderAtUtc !== todo.dueAtUtc && <span><Icon name="bell" />提醒 {dueLabel(todo.reminderAtUtc)}</span>}
          {todo.recurrenceRule && <span><Icon name="repeat" />重复</span>}
          {list && <span className="list-chip"><i style={{ background: list.color }} />{list.name}</span>}
        </div>
      </div>
      <div className="todo-actions">
        {todo.status === "open" && (todo.reminderAtUtc || todo.dueAtUtc) && (
          <details className="snooze-menu">
            <summary title="稍后提醒"><Icon name="snooze" />稍后</summary>
            <div className="snooze-options">
              <button onClick={() => onSnooze(todo, 10)} type="button">10 分钟后</button>
              <button onClick={() => onSnooze(todo, 60)} type="button">1 小时后</button>
              <button onClick={() => onSnooze(todo, untilTomorrowMorning)} type="button">明早 9 点</button>
            </div>
          </details>
        )}
        <button title="编辑待办" onClick={() => onEdit(todo)} type="button"><Icon name="edit" />编辑</button>
      </div>
    </article>
  );
}
