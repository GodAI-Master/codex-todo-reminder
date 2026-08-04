import type { ConnectionStatus } from "../hooks/useConnectionStatus.js";

export function StatusBanner({ status }: { status: ConnectionStatus }) {
  if (status === "connected") return null;
  return (
    <div className={`status-banner ${status}`} role="status">
      <span className="status-spinner" aria-hidden="true" />
      {status === "connecting" ? "正在连接本机提醒服务…" : "连接暂时中断，正在自动恢复…"}
    </div>
  );
}
