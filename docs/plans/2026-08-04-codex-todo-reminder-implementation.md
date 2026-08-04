# Codex 待办任务管理与提醒 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一款独立运行、随 Windows 启动、可嵌入 Codex 并在 Codex 关闭时继续提醒的本地待办产品。

**Architecture:** 采用单机模块化应用。Node.js 后台负责接口、SQLite、提醒调度和页面托管；PowerShell 守护程序负责自启动与恢复；独立注入器负责 Codex 侧边栏入口；CLI 与 Codex 技能提供自然语言操作能力。

**Tech Stack:** Node.js 22、TypeScript、Fastify、React、Vite、SQLite `node:sqlite`、RRULE、Windows Toast、PowerShell、Vitest、Playwright。

---

## 实施前约束

- 产品根目录固定为 `D:\CodeX\codex-todo-reminder`。
- 运行数据固定放到 `%LOCALAPPDATA%\CodexTodoReminder`，不得写进代码目录。
- 本机服务固定使用 `127.0.0.1:47831`；安装时必须先检测冲突。
- Codex 调试入口默认使用 `127.0.0.1:9222`；若已经存在则只附着。
- 每个任务严格按“先写失败测试、确认失败、实现、确认通过、提交”的顺序完成。
- 不得复制或引用 `dashi-taskboard` 的数据库、接口和运行状态。

### Task 1：建立独立项目骨架与健康检查

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `server/app.ts`
- Create: `server/config.ts`
- Create: `server/main.ts`
- Create: `tests/server/health.test.ts`

**Step 1：初始化独立仓库**

Run:

```powershell
Set-Location 'D:\CodeX\codex-todo-reminder'
git init
npm init -y
```

Expected: 生成 `.git`、`package.json`，并且 `git status` 只显示新项目文件。

**Step 2：安装最小依赖并锁定版本**

Run:

```powershell
npm install --save-exact fastify @fastify/static @fastify/cors zod rrule node-notifier react react-dom
npm install --save-dev --save-exact typescript tsx vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/user-event @types/node @types/react @types/react-dom @types/node-notifier playwright
```

Expected: `package-lock.json` 生成，`npm audit` 不含高危问题；若存在高危问题，先更换依赖，不用 `--force` 掩盖。

**Step 3：先写健康检查失败测试**

`tests/server/health.test.ts` 验证 `GET /health` 返回：

```ts
expect(response.statusCode).toBe(200);
expect(response.json()).toMatchObject({
  ok: true,
  service: 'codex-todo-reminder'
});
```

Run: `npm test -- tests/server/health.test.ts`  
Expected: FAIL，原因是 `buildApp` 尚不存在。

**Step 4：实现最小服务**

`server/config.ts` 统一读取端口、数据目录和日志目录；`server/app.ts` 导出 `buildApp()`；`server/main.ts` 只负责启动和关闭信号。服务必须绑定 `127.0.0.1`，不得使用 `0.0.0.0`。

Run: `npm test -- tests/server/health.test.ts`  
Expected: PASS。

**Step 5：提交**

```powershell
git add .
git commit -m "chore: initialize standalone todo reminder"
```

### Task 2：建立数据库、迁移与核心数据模型

**Files:**
- Create: `server/db/database.ts`
- Create: `server/db/migrate.ts`
- Create: `server/db/migrations/001_initial.sql`
- Create: `server/repositories/todo-repository.ts`
- Create: `server/repositories/list-repository.ts`
- Create: `tests/server/database.test.ts`
- Create: `tests/server/todo-repository.test.ts`

**Step 1：编写迁移测试**

测试临时数据库迁移后包含：`lists`、`todos`、`occurrences`、`notification_deliveries`、`settings`、`schema_migrations`。同时断言：

```ts
expect(uniqueIndexes).toContain('occurrences_todo_scheduled_unique');
expect(journalMode).toBe('wal');
expect(foreignKeys).toBe(1);
```

Run: `npm test -- tests/server/database.test.ts`  
Expected: FAIL，迁移模块不存在。

**Step 2：实现数据库初始化**

使用 `DatabaseSync`，打开后执行：

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

所有 ID 使用 UUID；所有时间使用 ISO UTC 字符串；`todos.deleted_at_utc` 实现软删除。

**Step 3：编写仓储失败测试**

覆盖新增、更新、完成、恢复、软删除、按清单筛选，以及更新不存在记录返回明确错误。

Run: `npm test -- tests/server/todo-repository.test.ts`  
Expected: FAIL。

**Step 4：实现最小仓储并通过测试**

SQL 必须使用绑定参数。更新操作使用事务并检查影响行数，不允许静默成功。

Run: `npm test -- tests/server/database.test.ts tests/server/todo-repository.test.ts`  
Expected: PASS。

**Step 5：提交**

```powershell
git add server/db server/repositories tests/server
git commit -m "feat: add todo database and repositories"
```

### Task 3：实现重复规则、时区与执行实例

**Files:**
- Create: `server/domain/todo.ts`
- Create: `server/domain/recurrence.ts`
- Create: `server/services/occurrence-service.ts`
- Create: `tests/server/recurrence.test.ts`
- Create: `tests/server/occurrence-service.test.ts`

**Step 1：编写时间边界测试**

至少覆盖：单次任务、每日、工作日、每周、每月最后一天、跨月、系统时区变化、完成重复实例后生成下一次，以及重复生成调用的幂等性。

Run: `npm test -- tests/server/recurrence.test.ts`  
Expected: FAIL。

**Step 2：实现重复规则**

只允许首版界面支持的有限规则，内部保存为 RRULE。禁止网页直接提交任意未校验 RRULE。每次生成实例时依赖唯一约束防重。

**Step 3：实现实例服务**

创建任务时生成首个实例；完成重复实例后生成下一个；修改重复规则后只重排尚未发送、尚未完成的未来实例。

Run: `npm test -- tests/server/recurrence.test.ts tests/server/occurrence-service.test.ts`  
Expected: PASS。

**Step 4：提交**

```powershell
git add server/domain server/services tests/server
git commit -m "feat: add recurrence and occurrence scheduling"
```

### Task 4：实现待办、清单和视图接口

**Files:**
- Create: `server/routes/todos.ts`
- Create: `server/routes/lists.ts`
- Create: `server/routes/views.ts`
- Create: `server/routes/errors.ts`
- Create: `server/schemas/todo-schema.ts`
- Create: `tests/server/todo-api.test.ts`
- Create: `tests/server/views-api.test.ts`

**Step 1：编写接口失败测试**

覆盖以下接口：

```text
POST   /api/todos
GET    /api/todos/:id
PATCH  /api/todos/:id
POST   /api/todos/:id/complete
POST   /api/todos/:id/restore
POST   /api/todos/:id/snooze
DELETE /api/todos/:id
GET    /api/views/inbox
GET    /api/views/today
GET    /api/views/upcoming
GET    /api/views/completed
GET    /api/lists
POST   /api/lists
PATCH  /api/lists/:id
```

测试无效日期、空标题、未知优先级和不存在 ID 的错误响应。

Run: `npm test -- tests/server/todo-api.test.ts`  
Expected: FAIL。

**Step 2：实现校验和接口**

统一错误格式：

```json
{
  "error": {
    "code": "INVALID_DUE_TIME",
    "message": "截止时间无效"
  }
}
```

接口成功修改后返回完整最新对象，不让页面猜测服务端状态。

Run: `npm test -- tests/server/todo-api.test.ts tests/server/views-api.test.ts`  
Expected: PASS。

**Step 3：提交**

```powershell
git add server/routes server/schemas tests/server
git commit -m "feat: add todo list and view APIs"
```

### Task 5：实现提醒调度、补发和去重

**Files:**
- Create: `server/services/reminder-scheduler.ts`
- Create: `server/repositories/delivery-repository.ts`
- Create: `server/services/missed-reminder-policy.ts`
- Create: `tests/server/reminder-scheduler.test.ts`
- Create: `tests/server/missed-reminder-policy.test.ts`

**Step 1：使用可控时钟编写失败测试**

测试以下场景：未到时间不发送、到时只发送一次、两个调度循环不会重复领取、发送失败会重试、重启后不重复、休眠 30 分钟后补发、超过补发窗口只进入摘要。

Run: `npm test -- tests/server/reminder-scheduler.test.ts`  
Expected: FAIL。

**Step 2：实现领取事务**

在一个事务中完成“查找到期实例、写入领取标记、创建发送账本”。使用 `claim_token` 与领取超时，处理进程在发送前崩溃的情况。

**Step 3：实现 15 秒循环与恢复扫描**

调度器启动时立即扫描一次，此后每 15 秒扫描；关闭时停止定时器并等待当前事务结束。

Run: `npm test -- tests/server/reminder-scheduler.test.ts tests/server/missed-reminder-policy.test.ts`  
Expected: PASS。

**Step 4：提交**

```powershell
git add server/services server/repositories tests/server
git commit -m "feat: add reliable reminder scheduler"
```

### Task 6：验证并接入 Windows 系统通知

**Files:**
- Create: `server/notifications/notifier.ts`
- Create: `server/notifications/windows-toast.ts`
- Create: `server/notifications/activation-handler.ts`
- Create: `scripts/register-notification-app.ps1`
- Create: `scripts/test-windows-toast.ps1`
- Create: `tests/server/windows-toast.test.ts`

**Step 1：先做通知适配器测试**

模拟通知发送器，断言标题、正文、待办 ID 和三个操作被正确传递。错误必须写入发送账本，不得导致后台退出。

Run: `npm test -- tests/server/windows-toast.test.ts`  
Expected: FAIL。

**Step 2：注册通知身份与操作协议**

安装脚本为当前用户注册 `CodexTodoReminder` 通知身份和 `codextodo://` 操作协议。协议处理器只接受 `complete`、`snooze10`、`snooze60`、`open`，并校验 UUID，拒绝任意命令。

**Step 3：完成人工通知闸门**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-notification-app.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-windows-toast.ps1
```

Expected:

- Windows 显示名称为“待办任务”的通知，不显示 PowerShell 或 SnoreToast。
- “完成”“10 分钟后”“1 小时后”均能改变测试待办状态。
- 关闭并重开后台后，通知正文点击仍能打开对应待办。

如果任一项失败，停止后续界面开发，先修复通知链路。

**Step 4：运行自动化测试并提交**

Run: `npm test -- tests/server/windows-toast.test.ts`  
Expected: PASS。

```powershell
git add server/notifications scripts tests/server
git commit -m "feat: add actionable Windows reminders"
```

### Task 7：建立 Codex 面板界面骨架

**Files:**
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/styles.css`
- Create: `web/src/components/AppShell.tsx`
- Create: `web/src/components/Sidebar.tsx`
- Create: `web/src/components/StatusBanner.tsx`
- Create: `web/src/lib/api.ts`
- Create: `web/src/lib/types.ts`
- Create: `tests/web/app-shell.test.tsx`

**Step 1：编写界面结构失败测试**

断言收集箱、今天、即将到期、重复任务、已完成五个入口存在；顶部显示今日剩余数和逾期数；断线状态可见。

Run: `npm test -- tests/web/app-shell.test.tsx`  
Expected: FAIL。

**Step 2：实现响应式骨架**

Codex 窄面板下使用紧凑单栏；宽面板显示导航与内容双栏。颜色和样式全部限定在产品根节点，禁止覆盖 Codex 全局样式。

**Step 3：构建并测试**

Run:

```powershell
npm test -- tests/web/app-shell.test.tsx
npm run build
```

Expected: PASS，`dist/web` 生成，Fastify 可访问 `/panel/`。

**Step 4：提交**

```powershell
git add web tests/web vite.config.ts
git commit -m "feat: add todo panel shell"
```

### Task 8：实现新增、编辑、完成和主要视图

**Files:**
- Create: `web/src/components/QuickAdd.tsx`
- Create: `web/src/components/TodoList.tsx`
- Create: `web/src/components/TodoItem.tsx`
- Create: `web/src/components/TodoEditor.tsx`
- Create: `web/src/components/Filters.tsx`
- Create: `web/src/pages/InboxPage.tsx`
- Create: `web/src/pages/TodayPage.tsx`
- Create: `web/src/pages/UpcomingPage.tsx`
- Create: `web/src/pages/RecurringPage.tsx`
- Create: `web/src/pages/CompletedPage.tsx`
- Create: `tests/web/todo-flows.test.tsx`

**Step 1：编写用户流程失败测试**

覆盖快速新增、补充日期、选择清单与优先级、完成、恢复、稍后提醒、搜索和筛选。完成操作先乐观更新；接口失败时必须恢复原状态并显示原因。

Run: `npm test -- tests/web/todo-flows.test.tsx`  
Expected: FAIL。

**Step 2：实现最小可用流程**

保持新增入口始终可见。日期和提醒使用明确的日期时间选择器；不在网页端猜测自然语言日期。

**Step 3：验证空状态和错误状态**

每个页面至少包含：正常列表、空列表、加载中、加载失败四种状态。

Run: `npm test -- tests/web/todo-flows.test.tsx`  
Expected: PASS。

**Step 4：提交**

```powershell
git add web/src tests/web
git commit -m "feat: add core todo management flows"
```

### Task 9：实现事件更新和自动重连

**Files:**
- Create: `server/routes/events.ts`
- Create: `server/services/event-bus.ts`
- Create: `web/src/lib/event-stream.ts`
- Create: `web/src/hooks/useConnectionStatus.ts`
- Create: `tests/server/events.test.ts`
- Create: `tests/web/reconnect.test.tsx`

**Step 1：编写断线恢复失败测试**

模拟服务离线、恢复和连续三次失败。断言页面不刷新也会恢复，并使用 1、2、4、8 秒退避，最大 15 秒；重新连接后自动重新加载当前视图。

Run: `npm test -- tests/web/reconnect.test.tsx`  
Expected: FAIL。

**Step 2：实现 SSE 与重连**

后台在待办变化后发送轻量事件，只传 ID 和事件类型；页面收到事件后重新获取对应数据。断开时显示“正在重新连接”，不显示无效的手动重试主按钮。

Run: `npm test -- tests/server/events.test.ts tests/web/reconnect.test.tsx`  
Expected: PASS。

**Step 3：提交**

```powershell
git add server web tests
git commit -m "feat: add live updates and automatic reconnect"
```

### Task 10：实现本机授权、CLI 与 Codex 技能

**Files:**
- Create: `server/security/local-auth.ts`
- Create: `server/security/origin-policy.ts`
- Create: `scripts/todoctl.mjs`
- Create: `skills/manage-todos/SKILL.md`
- Create: `skills/manage-todos/references/commands.md`
- Create: `tests/server/security.test.ts`
- Create: `tests/cli/todoctl.test.ts`

**Step 1：编写安全失败测试**

覆盖：无令牌、错误令牌、外部 Origin、表单型跨站请求、合法 iframe 请求、合法 CLI 请求。日志断言中不得出现令牌。

Run: `npm test -- tests/server/security.test.ts`  
Expected: FAIL。

**Step 2：实现本机令牌**

首次运行生成 32 字节随机令牌，保存到 `%LOCALAPPDATA%\CodexTodoReminder\config\auth.json`。面板令牌通过注入器的一次性启动片段传递，读取后立即从地址栏移除。

**Step 3：编写并实现 CLI**

支持：

```text
todoctl add --title ... --due ... --remind ... --list ... --priority ...
todoctl list --view today --json
todoctl update TODO-ID ...
todoctl complete TODO-ID
todoctl snooze TODO-ID --minutes 10
todoctl delete TODO-ID
```

所有机器可读输出使用 JSON；失败时返回非零退出码和明确错误码。

**Step 4：编写 Codex 技能**

技能要求 Codex：解析用户时间表达后转成带时区的 ISO 时间；有歧义时先确认；写入后回读并用自然语言确认标题、日期和提醒时间。

Run: `npm test -- tests/server/security.test.ts tests/cli/todoctl.test.ts`  
Expected: PASS。

**Step 5：提交**

```powershell
git add server/security scripts/todoctl.mjs skills tests
git commit -m "feat: add secure Codex todo tool"
```

### Task 11：实现独立 Codex 侧边栏注入器

**Files:**
- Create: `inject/codex-todo.user.js`
- Create: `scripts/codex-injector.mjs`
- Create: `scripts/codex-cdp-client.mjs`
- Create: `tests/inject/injector-dom.test.ts`
- Create: `scripts/smoke-codex-injection.mjs`

**Step 1：编写幂等注入失败测试**

在模拟 Codex DOM 中连续运行三次，断言只存在一个 `data-codex-todo-entry` 和一个面板容器；卸载函数只删除本产品节点，不影响其他入口。

Run: `npm test -- tests/inject/injector-dom.test.ts`  
Expected: FAIL。

**Step 2：实现多重定位和样式隔离**

定位顺序：稳定属性、语义标签、已知侧栏容器。找不到位置时记录 Codex 版本和诊断信息，不修改未知节点。iframe 地址加入一次性授权片段。

**Step 3：实现持续自检**

注入器检测页面导航、窗口刷新和 DOM 重建；入口消失后自动恢复。连接 CDP 失败时退避重试，不退出整个后台服务。

**Step 4：运行真实冒烟测试**

Run: `npm run smoke:codex-injection`  
Expected JSON:

```json
{
  "codexDetected": true,
  "entryCount": 1,
  "panelReachable": true
}
```

同时人工确认现有任务面板仍可打开，两个入口互不覆盖。

**Step 5：提交**

```powershell
git add inject scripts tests/inject
git commit -m "feat: embed standalone todo panel in Codex"
```

### Task 12：实现 Windows 守护、自启动与安装卸载

**Files:**
- Create: `scripts/codex-todo-supervisor-windows.ps1`
- Create: `scripts/start-codex-todo-windows.ps1`
- Create: `scripts/install-windows.ps1`
- Create: `scripts/uninstall-windows.ps1`
- Create: `scripts/check-installation.ps1`
- Create: `tests/windows/supervisor-recovery.ps1`
- Create: `tests/windows/install-idempotency.ps1`

**Step 1：编写安装幂等测试**

连续执行两次安装，断言只存在一个 `CodexTodoReminderSupervisor` 计划任务、一个技能目录和一个通知身份。卸载后用户数据库与备份默认保留。

Run: `powershell -File .\tests\windows\install-idempotency.ps1`  
Expected: 首次安装成功，第二次报告“已是最新配置”，无重复项目。

**Step 2：实现登录启动**

计划任务以当前交互用户在登录时启动隐藏守护程序。任务自身设置失败重启；守护程序每 5 秒调用 `/health`，服务异常后在 10 秒内恢复。

**Step 3：处理 Codex 启动入口**

安装前备份相关快捷方式到 `%LOCALAPPDATA%\CodexTodoReminder\shortcut-backups`。如果现有入口已经带 `--remote-debugging-port=9222`，保持不变；否则创建“Codex（带待办）”兼容入口，不静默删除原快捷方式。

**Step 4：运行强制恢复测试**

测试脚本依次结束后台、注入器和两者，记录恢复耗时；连续执行三轮。

Run: `powershell -File .\tests\windows\supervisor-recovery.ps1`  
Expected: 每轮服务恢复小于 10 秒，注入入口恢复小于 15 秒，没有第二个 Codex 进程被启动。

**Step 5：提交**

```powershell
git add scripts tests/windows
git commit -m "feat: add Windows startup and recovery"
```

### Task 13：实现备份、恢复、导入导出与设置

**Files:**
- Create: `server/services/backup-service.ts`
- Create: `server/services/import-export-service.ts`
- Create: `server/routes/settings.ts`
- Create: `server/routes/data-management.ts`
- Create: `web/src/pages/SettingsPage.tsx`
- Create: `tests/server/backup.test.ts`
- Create: `tests/server/import-export.test.ts`

**Step 1：编写真实恢复失败测试**

创建待办、生成备份、修改原库、从备份恢复，断言恢复后的标题和数量与备份时一致。再使用损坏文件恢复，断言系统拒绝并保留原库。

Run: `npm test -- tests/server/backup.test.ts`  
Expected: FAIL。

**Step 2：实现在线备份和保留策略**

使用 `node:sqlite` 的在线备份能力；完成后运行 `PRAGMA integrity_check`。每天最多生成一份自动备份，保留最近 14 份；手动备份不被自动清理。

**Step 3：实现 JSON 导入导出**

导出包含版本号和时区。导入分“校验、预览、执行”三步；首版只支持合并，不支持不经确认覆盖全部数据。

Run: `npm test -- tests/server/backup.test.ts tests/server/import-export.test.ts`  
Expected: PASS。

**Step 4：提交**

```powershell
git add server web tests/server
git commit -m "feat: add backup restore and data portability"
```

### Task 14：完成端到端验收和交付文档

**Files:**
- Create: `tests/e2e/todo-panel.spec.ts`
- Create: `tests/e2e/reminder-recovery.spec.ts`
- Create: `docs/INSTALL_ZH.md`
- Create: `docs/USER_GUIDE_ZH.md`
- Create: `docs/TROUBLESHOOTING_ZH.md`
- Create: `docs/RELEASE_CHECKLIST.md`
- Create: `README.md`

**Step 1：编写核心端到端测试**

使用临时数据目录启动完整服务，覆盖新增、编辑、提醒、稍后提醒、完成、重复实例、搜索、刷新和断线重连。

Run: `npm run test:e2e`  
Expected: 所有测试通过，并保存失败截图和服务日志。

**Step 2：执行六类真实演练**

按顺序完成并记录结果：

1. 强制结束后台并等待自动恢复。
2. 电脑休眠后恢复，验证补发且只发一次。
3. 关闭、重开、刷新 Codex，验证入口恢复。
4. 临时关闭 Windows 通知，验证面板警告。
5. 从实际备份恢复数据库。
6. 与 `dashi-taskboard` 同时运行至少 30 分钟。

**Step 3：执行完整检查**

Run:

```powershell
npm test
npm run build
npm run test:e2e
powershell -File .\scripts\check-installation.ps1
```

Expected: 全部退出码为 0；检查脚本输出服务、调度器、注入器、计划任务、通知身份、技能和最近备份均正常。

**Step 4：安装正式首版**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

安装完成后真实创建一个两分钟后的测试提醒，关闭 Codex，确认 Windows 通知仍然出现；重新打开 Codex，确认该待办状态正确。

**Step 5：提交与标记版本**

```powershell
git add .
git commit -m "docs: add installation and release verification"
git tag v0.1.0
```

## 推荐实施顺序与预计投入

| 阶段 | 包含任务 | 预计投入 | 完成标志 |
|---|---:|---:|---|
| 风险验证 | Task 1–6 | 1.5–2 天 | 数据、重复规则、Windows 可操作通知可靠 |
| 核心产品 | Task 7–10 | 1.5–2 天 | 面板和 Codex 自然语言操作可用 |
| 嵌入运行 | Task 11–12 | 1–1.5 天 | 自动嵌入、自启动和异常恢复通过 |
| 交付加固 | Task 13–14 | 1 天 | 备份恢复及六类验收通过 |

首版合理工期为 5–6.5 个开发日。任何阶段发现通知操作或 Codex 注入不稳定，应在该阶段解决，不把已知问题推迟到交付验收。

## 最终交付物

- Codex 独立“待办任务”面板。
- Windows 常驻提醒与通知操作。
- `manage-todos` Codex 技能和 `todoctl` 工具。
- 一键安装、检查和卸载脚本。
- 独立数据库、14 日备份和导入导出。
- 自动化测试、真实验收记录和中文使用手册。
