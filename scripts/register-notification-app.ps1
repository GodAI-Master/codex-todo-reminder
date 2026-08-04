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
Write-Output "Windows notification identity registered."
