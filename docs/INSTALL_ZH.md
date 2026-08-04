# Windows 安装说明

## 标准安装

确认已安装 Node.js 22.16+、Git 和 Codex Desktop，然后运行：

```powershell
git clone https://github.com/GodAI-Master/codex-todo-reminder.git
cd codex-todo-reminder
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

安装完成后使用桌面或开始菜单中的 Codex 快捷方式。首次打开几秒内，左侧会出现“待办任务”。

## 升级

```powershell
cd codex-todo-reminder
git pull
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

升级不会删除待办数据库和备份。

## 验证

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-installation.ps1
```

## 卸载

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\uninstall-windows.ps1
```
