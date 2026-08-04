param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$toast = Join-Path $ProjectRoot "node_modules\node-notifier\vendor\snoreToast\snoretoast-x64.exe"
if (-not (Test-Path -LiteralPath $toast)) {
  throw "Notification component is missing. Run npm install first."
}
$powershell = Join-Path $PSHOME "powershell.exe"
& $toast -install "Codex Todo Reminder" $powershell "CodexTodoReminder" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Windows notification identity registration failed." }

$protocolRoot = "HKCU:\Software\Classes\codex-todo-reminder"
$commandKey = Join-Path $protocolRoot "shell\open\command"
$wscript = Join-Path ([System.Environment]::SystemDirectory) "wscript.exe"
$handler = Join-Path $PSScriptRoot "handle-todo-action.vbs"
New-Item -Path $commandKey -Force | Out-Null
Set-Item -Path $protocolRoot -Value "URL:Codex Todo Reminder"
New-ItemProperty -Path $protocolRoot -Name "URL Protocol" -PropertyType String -Value "" -Force | Out-Null
Set-Item -Path $commandKey -Value "`"$wscript`" `"$handler`" `"%1`""
Write-Output "Windows notification identity registered."
