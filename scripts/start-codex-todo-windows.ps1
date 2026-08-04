param([int]$DebugPort = 9231)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$supervisor = Join-Path $PSScriptRoot "codex-todo-supervisor-windows.ps1"
$debugOrigin = "http://127.0.0.1:$DebugPort"
$fallbackProfile = Join-Path $env:LOCALAPPDATA "CodexTodoReminder\codex-profile"

function Test-CodexTarget {
  try {
    $targets = Invoke-RestMethod -Uri "$debugOrigin/json/list" -TimeoutSec 1
    return @($targets | Where-Object { $_.type -eq "page" -and $_.url -like "app://-/index.html*" -and $_.url -notlike "*avatar-overlay*" }).Count -gt 0
  } catch { return $false }
}

$runningSupervisor = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$supervisor*" } | Select-Object -First 1
if (-not $runningSupervisor) {
  Start-Process -FilePath (Join-Path $PSHOME "powershell.exe") -ArgumentList @("-NoProfile","-WindowStyle","Hidden","-ExecutionPolicy","Bypass","-File",$supervisor,"-DebugPort","$DebugPort") -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
}

if (-not (Test-CodexTarget)) {
  $package = Get-AppxPackage OpenAI.Codex
  if (-not $package) { throw "Codex is not installed for the current Windows user." }
  $executable = Join-Path $package.InstallLocation "app\ChatGPT.exe"
  if (-not (Test-Path -LiteralPath $executable)) { throw "Codex executable was not found." }
  $mainCodex = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -notmatch '(?:^|\s)--type=' })
  $arguments = @("--remote-debugging-port=$DebugPort", "--remote-allow-origins=$debugOrigin")
  if ($mainCodex.Count -gt 0) {
    New-Item -ItemType Directory -Force -Path $fallbackProfile | Out-Null
    $arguments += "--user-data-dir=`"$fallbackProfile`""
  }
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $executable
  $info.Arguments = $arguments -join " "
  $info.UseShellExecute = $false
  if ($mainCodex.Count -gt 0) { $info.EnvironmentVariables["CODEX_ELECTRON_USER_DATA_PATH"] = $fallbackProfile }
  [System.Diagnostics.Process]::Start($info) | Out-Null
}

$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline -and -not (Test-CodexTarget)) { Start-Sleep -Milliseconds 500 }
if (-not (Test-CodexTarget)) { throw "Codex did not expose its local panel connection in time." }
