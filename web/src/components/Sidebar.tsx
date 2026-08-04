import type { ViewId } from "../lib/types.js";

type NavItem = { id: ViewId; label: string; mark: string };

const NAV_ITEMS: NavItem[] = [
  { id: "inbox", label: "收集箱", mark: "□" },
  { id: "today", label: "今天", mark: "今" },
  { id: "upcoming", label: "即将到期", mark: "→" },
  { id: "recurring", label: "重复任务", mark: "↻" },
  { id: "completed", label: "已完成", mark: "✓" },
  { id: "settings", label: "设置与备份", mark: "⚙" },
];

export function Sidebar({ view, onChange }: { view: ViewId; onChange: (view: ViewId) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-logo" aria-hidden="true">✓</span>
        <strong>待办任务</strong>
      </div>
      <nav aria-label="待办视图">
        {NAV_ITEMS.map((item) => (
          <button
            className={view === item.id ? "nav-item active" : "nav-item"}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            <span className="nav-mark" aria-hidden="true">{item.mark}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="pulse-dot" />
        Windows 后台提醒已启用
      </div>
    </aside>
  );
}
