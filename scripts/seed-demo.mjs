const base = process.env.CODEX_TODO_URL ?? "http://127.0.0.1:47831";

async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const list = await request("/api/lists", { name: "Vibe Coding", color: "#D75E3D" });
for (const todo of [
  {
    title: "完成待办面板交互检查",
    notes: "检查窄屏、空状态与编辑抽屉",
    priority: "high",
    dueAt: "2026-08-04T18:30:00+08:00",
    listId: list.id,
  },
  {
    title: "整理 GitHub 安装说明",
    notes: "确保新用户能用一条命令完成安装",
    priority: "medium",
    dueAt: "2026-08-05T10:00:00+08:00",
    listId: list.id,
  },
  {
    title: "记录今天的工作复盘",
    notes: "写下一个做得好的地方和一个改进点",
    priority: "low",
  },
  {
    title: "每周清理收集箱",
    priority: "none",
    dueAt: "2026-08-07T17:00:00+08:00",
    recurrence: { kind: "weekly", interval: 1 },
  },
]) await request("/api/todos", todo);

console.log("Demo todos created.");
