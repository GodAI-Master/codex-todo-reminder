param([int]$DebugPort = 9231)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$supervisor = Join-Path $PSScriptRoot "codex-todo-supervisor-windows.ps1"
$running = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
  $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like "*$supervisor*"
} | Select-Object -First 1

if (-not $running) {
  Start-Process -FilePath (Join-Path $PSHOME "powershell.exe") `
    -ArgumentList @("-NoProfile","-WindowStyle","Hidden","-ExecutionPolicy","Bypass","-File",$supervisor,"-DebugPort","$DebugPort") `
    -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
}
