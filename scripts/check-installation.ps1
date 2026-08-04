$ErrorActionPreference = "SilentlyContinue"
$projectRoot = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $env:LOCALAPPDATA "CodexTodoReminder"
$health = Invoke-RestMethod -Uri "http://127.0.0.1:47831/health" -TimeoutSec 2
$task = Get-ScheduledTask -TaskName "CodexTodoReminderSupervisor"
$service = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*$projectRoot*dist\server\main.js*" } | Select-Object -First 1
$injector = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*$projectRoot*codex-injector.mjs*" } | Select-Object -First 1
$result = [ordered]@{
  healthy = $health.ok -eq $true
  serviceRunning = $null -ne $service
  injectorRunning = $null -ne $injector
  startupRegistered = $null -ne $task -or $null -ne (Get-ItemPropertyValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "CodexTodoReminderSupervisor")
  authReady = Test-Path -LiteralPath (Join-Path $localRoot "config\auth.json")
  skillReady = Test-Path -LiteralPath (Join-Path $env:USERPROFILE ".codex\skills\manage-todos\SKILL.md")
  databaseReady = Test-Path -LiteralPath (Join-Path $localRoot "data\todo.db")
}
$result | ConvertTo-Json
if (@($result.Values | Where-Object { $_ -ne $true }).Count -gt 0) { exit 1 }
