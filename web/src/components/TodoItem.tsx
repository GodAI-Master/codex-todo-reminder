import type { Todo, TodoList } from "../lib/types.js";

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
  onSnooze: (todo: Todo) => void;
}) {
  const list = lists.find((item) => item.id === todo.listId);
  const overdue = Boolean(todo.dueAtUtc && todo.status === "open" && new Date(todo.dueAtUtc).getTime() < Date.now());
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
          {todo.dueAtUtc && <span className={overdue ? "due overdue" : "due"}>{overdue ? "已逾期 · " : ""}{dueLabel(todo.dueAtUtc)}</span>}
          {todo.recurrenceRule && <span>↻ 重复</span>}
          {list && <span className="list-chip"><i style={{ background: list.color }} />{list.name}</span>}
        </div>
      </div>
      <div className="todo-actions">
        {todo.status === "open" && todo.reminderAtUtc && (
          <button title="10 分钟后提醒" onClick={() => onSnooze(todo)} type="button">稍后</button>
        )}
        <button title="编辑待办" onClick={() => onEdit(todo)} type="button">编辑</button>
      </div>
    </article>
  );
}
