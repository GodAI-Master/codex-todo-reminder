$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$taskName = "CodexTodoReminderSupervisor"
$supervisor = Join-Path $PSScriptRoot "codex-todo-supervisor-windows.ps1"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name $taskName -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "HKCU:\Software\Classes\codex-todo-reminder" -Recurse -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $PID -and $_.CommandLine -and (
    ($_.Name -eq "node.exe" -and $_.CommandLine -like "*$projectRoot*") -or
    ($_.Name -eq "powershell.exe" -and $_.CommandLine -like "*$supervisor*")
  )
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$skillsRoot = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE ".codex\skills"))
$skillTarget = [IO.Path]::GetFullPath((Join-Path $skillsRoot "manage-todos"))
if ((Split-Path -Parent $skillTarget) -ne $skillsRoot -or (Split-Path -Leaf $skillTarget) -ne "manage-todos") {
  throw "Refusing to remove an unexpected skill path."
}
Remove-Item -LiteralPath $skillTarget -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "Codex Todo Reminder was uninstalled. Your todo database and backups were kept in LocalAppData."
