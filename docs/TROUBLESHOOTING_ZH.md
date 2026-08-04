# 故障排查

## 一键检查

在项目目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-installation.ps1
```

结果中的项目都应为 `true`。如果有任一项为 `false`，先重新运行安装程序；安装程序可以安全重复执行。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

## Codex 中没有“待办任务”

请从安装程序生成的桌面或开始菜单 **Codex** 快捷方式打开。它会为 Codex 开启本地面板连接，并同时启动后台守护。

如果 Codex 已经打开，关闭所有 Codex 窗口后再使用该快捷方式。仍未出现时，运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-codex-todo-windows.ps1
```

## 面板显示正在重新连接

通常无需手动处理：面板按 1、2、4、8、15 秒间隔自动重连，后台守护每 2 秒检查一次，异常进程会被重新启动。

若超过 30 秒仍未恢复：

1. 运行一键检查。
2. 查看 `%LOCALAPPDATA%\CodexTodoReminder\logs` 中的日志。
3. 重新运行安装程序修复构建和自启动项。

## 没有 Windows 通知

检查 Windows“设置 → 系统 → 通知”，确认没有关闭“待办任务”的通知。然后重新运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-notification-app.ps1
```

## 开机后没有自动运行

一键检查中的 `startupRegistered` 应为 `true`。安装程序优先创建登录计划任务；如果当前账户不允许，会自动改用当前用户的启动项。

## 端口冲突

待办后台固定使用本机端口 `47831`，Codex 面板连接默认使用 `9231`。如果其他软件占用 `47831`，请先退出该软件再重新安装。`9231` 可以与现有 dashi-taskboard 共用。

## 数据恢复

即使卸载，数据仍保留在 `%LOCALAPPDATA%\CodexTodoReminder`。可重新安装后从“设置与备份”恢复，或把整个目录复制到安全位置。

