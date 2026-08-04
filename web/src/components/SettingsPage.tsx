import { useEffect, useRef, useState } from "react";

import { api } from "../lib/api.js";
import type { BackupItem } from "../lib/types.js";
import { Icon } from "./Icon.js";

export function SettingsPage({ onChanged }: { onChanged: () => Promise<void> }) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function refresh() {
    const result = await api.backups();
    setBackups(result.items);
  }

  useEffect(() => { void refresh(); }, []);

  async function run(operation: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try { setMessage(await operation()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
  }

  function download(data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `codex-todos-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  async function importFile(file: File) {
    const data = JSON.parse(await file.text()) as unknown;
    const preview = await api.importPreview(data);
    if (!window.confirm(`将导入 ${preview.todos} 条待办和 ${preview.lists} 个清单。重复内容会跳过，是否继续？`)) return "已取消导入";
    const result = await api.importData(data);
    await onChanged();
    return `导入完成：新增 ${result.todosAdded} 条待办，跳过 ${result.skipped} 条`;
  }

  return (
    <section className="settings-page">
      <div className="settings-card reminder-policy-card">
        <div className="settings-copy"><span className="settings-icon"><Icon name="bell" /></span><div><h2>智能提醒</h2><p>按设定时间提醒；恢复运行时最多补发最近 3 条，失败最多重试 3 次。</p></div></div>
        <span className="policy-status"><i />正在守护</span>
      </div>
      <div className="settings-card">
        <div className="settings-copy"><span className="settings-icon"><Icon name="download" /></span><div><h2>数据导出</h2><p>保存一份可迁移的 JSON 文件，可在另一台电脑上导入。</p></div></div>
        <button className="secondary-button button-with-icon" disabled={busy} onClick={() => void run(async () => { download(await api.exportData()); return "导出文件已生成"; })}><Icon name="download" />导出全部待办</button>
      </div>
      <div className="settings-card">
        <div className="settings-copy"><span className="settings-icon"><Icon name="upload" /></span><div><h2>数据导入</h2><p>先检查文件内容，确认后合并；已有记录不会被覆盖。</p></div></div>
        <input ref={input} hidden type="file" accept="application/json,.json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void run(() => importFile(file));
          event.currentTarget.value = "";
        }} />
        <button className="secondary-button button-with-icon" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" />选择导入文件</button>
      </div>
      <div className="settings-card backup-card">
        <div className="settings-card-header">
          <div className="settings-copy"><span className="settings-icon"><Icon name="backup" /></span><div><h2>本机备份</h2><p>系统每天自动备份一次，并保留最近 14 份。</p></div></div>
          <button className="primary-button button-with-icon" disabled={busy} onClick={() => void run(async () => {
            const result = await api.createBackup();
            await refresh();
            return `备份已创建：${result.name}`;
          })}><Icon name="backup" />立即备份</button>
        </div>
        <div className="backup-list">
          {backups.length ? backups.map((item) => (
            <div className="backup-row" key={item.name}>
              <div><strong>{item.name}</strong><span>{new Date(item.modifiedAtUtc).toLocaleString("zh-CN")} · {(item.size / 1024).toFixed(1)} KB</span></div>
              <button className="secondary-button" disabled={busy} onClick={() => {
                if (!window.confirm("恢复后将重启待办服务，当前数据会先自动留存。确认恢复这份备份？")) return;
                void run(async () => { await api.restoreBackup(item.name); return "正在恢复并重启，面板会自动重新连接…"; });
              }}>恢复</button>
            </div>
          )) : <div className="backup-empty">还没有本机备份</div>}
        </div>
      </div>
      {message && <div className="settings-message" role="status">{message}</div>}
    </section>
  );
}
