import type { ViewId } from "../lib/types.js";
import { Icon, type IconName } from "./Icon.js";

type NavItem = { id: ViewId; label: string; icon: IconName };

const NAV_ITEMS: NavItem[] = [
  { id: "inbox", label: "收集箱", icon: "inbox" },
  { id: "today", label: "今天", icon: "today" },
  { id: "upcoming", label: "即将到期", icon: "upcoming" },
  { id: "recurring", label: "重复任务", icon: "repeat" },
  { id: "completed", label: "已完成", icon: "completed" },
  { id: "settings", label: "设置与备份", icon: "settings" },
];

export function Sidebar({ view, onChange }: { view: ViewId; onChange: (view: ViewId) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-logo"><Icon name="app" /></span>
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
            <span className="nav-mark"><Icon name={item.icon} /></span>
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
