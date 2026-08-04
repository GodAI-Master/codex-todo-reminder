param([int]$DebugPort = 9231)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $env:LOCALAPPDATA "CodexTodoReminder"
$backupRoot = Join-Path $localRoot "shortcut-backups"
$supervisor = Join-Path $PSScriptRoot "codex-todo-supervisor-windows.ps1"
$watchdog = Join-Path $PSScriptRoot "ensure-codex-todo-running.ps1"
$launcher = Join-Path $PSScriptRoot "start-codex-todo-windows.ps1"
$taskName = "CodexTodoReminderSupervisor"

Write-Output "[1/6] Installing dependencies and building..."
Push-Location $projectRoot
try { npm install; if ($LASTEXITCODE -ne 0) { throw "npm install failed" }; npm run build; if ($LASTEXITCODE -ne 0) { throw "build failed" } }
finally { Pop-Location }

Write-Output "[2/6] Registering Windows notifications..."
& (Join-Path $PSScriptRoot "register-notification-app.ps1") -ProjectRoot $projectRoot

Write-Output "[3/6] Installing the Codex todo skill..."
$skillTarget = Join-Path $env:USERPROFILE ".codex\skills\manage-todos"
New-Item -ItemType Directory -Force -Path $skillTarget | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "skills\manage-todos\SKILL.md") -Destination (Join-Path $skillTarget "SKILL.md") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $skillTarget "references") | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "skills\manage-todos\references\commands.md") -Destination (Join-Path $skillTarget "references\commands.md") -Force

Write-Output "[4/6] Registering startup recovery..."
$action = New-ScheduledTaskAction -Execute (Join-Path $PSHOME "powershell.exe") -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdog`" -DebugPort $DebugPort" -WorkingDirectory $projectRoot
$watchdogTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$runCommand = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdog`" -DebugPort $DebugPort"
New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name $taskName -PropertyType String -Value $runCommand -Force | Out-Null
try {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $watchdogTrigger -Settings $settings -Description "Keeps Codex Todo Reminder running" | Out-Null
} catch {
  Write-Warning "Scheduled recovery could not be registered. Logon recovery is still enabled."
}

Write-Output "[5/6] Creating Codex launch shortcuts..."
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$shell = New-Object -ComObject WScript.Shell
$shortcutTargets = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "Codex.lnk"),
  (Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\Codex.lnk")
)
foreach ($shortcutPath in $shortcutTargets) {
  $directory = Split-Path -Parent $shortcutPath
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  if (Test-Path -LiteralPath $shortcutPath) {
    $existing = $shell.CreateShortcut($shortcutPath)
    if ($existing.Arguments -like "*dashi-taskboard*" -or $existing.Arguments -like "*start-codex-taskboard-windows.ps1*") { continue }
    Copy-Item -LiteralPath $shortcutPath -Destination (Join-Path $backupRoot ((Split-Path -Leaf $shortcutPath) + ".backup")) -Force
  }
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $PSHOME "powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`" -DebugPort $DebugPort"
  $shortcut.WorkingDirectory = $projectRoot
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,167"
  $shortcut.Description = "Codex with Todo Reminder"
  $shortcut.Save()
}

Write-Output "[6/6] Starting and checking the background service..."
$serviceEntry = Join-Path $projectRoot "dist\server\main.js"
$injectorEntry = Join-Path $projectRoot "scripts\codex-injector.mjs"
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
  $_.CommandLine -and ($_.CommandLine -like "*$serviceEntry*" -or $_.CommandLine -like "*$injectorEntry*")
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
  $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like "*$supervisor*"
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
& $watchdog -DebugPort $DebugPort
$deadline = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $deadline) {
  try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:47831/health" -TimeoutSec 2; if ($health.ok) { break } } catch {}
  Start-Sleep -Milliseconds 500
}
if (-not $health.ok) { throw "Background service did not become healthy." }
if (Test-Path -LiteralPath (Join-Path $localRoot "config\auth.json")) {
  & icacls (Join-Path $localRoot "config\auth.json") /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null
}
Write-Output "Installation complete. Open Codex from the Codex shortcut."
