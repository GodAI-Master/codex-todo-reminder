param(
  [int]$DebugPort = 9231
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$localRoot = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "CodexTodoReminder" } else { Join-Path $env:USERPROFILE "AppData\Local\CodexTodoReminder" }
$logDirectory = Join-Path $localRoot "logs"
$serviceLog = Join-Path $logDirectory "service.log"
$serviceErrorLog = Join-Path $logDirectory "service-error.log"
$injectorLog = Join-Path $logDirectory "injector.log"
$injectorErrorLog = Join-Path $logDirectory "injector-error.log"
$supervisorLog = Join-Path $logDirectory "supervisor.log"
$serviceEntry = Join-Path $projectRoot "dist\server\main.js"
$injectorEntry = Join-Path $projectRoot "scripts\codex-injector.mjs"
$healthUrl = "http://127.0.0.1:47831/health"
$mutexName = "Local\CodexTodoReminderSupervisor-$DebugPort"

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$created = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, ([ref]$created))
if (-not $created) { $mutex.Dispose(); exit 0 }

function Write-Log([string]$Message) {
  Add-Content -LiteralPath $supervisorLog -Encoding UTF8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff') $Message"
}

function Test-Health {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    return $health.ok -eq $true
  } catch { return $false }
}

function Get-NodeProcess([string]$Entry) {
  return Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -like "*$Entry*"
  } | Select-Object -First 1
}

function Start-ServiceProcess {
  $node = (Get-Command node -ErrorAction Stop).Source
  $previous = $env:CODEX_TODO_DATA_DIR
  try {
    $env:CODEX_TODO_DATA_DIR = $localRoot
    return Start-Process -FilePath $node -ArgumentList @($serviceEntry) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serviceLog -RedirectStandardError $serviceErrorLog -PassThru
  } finally { $env:CODEX_TODO_DATA_DIR = $previous }
}

function Start-InjectorProcess {
  $node = (Get-Command node -ErrorAction Stop).Source
  $previous = $env:CODEX_TODO_DATA_DIR
  try {
    $env:CODEX_TODO_DATA_DIR = $localRoot
    return Start-Process -FilePath $node -ArgumentList @($injectorEntry, "--watch", "--port", "$DebugPort") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $injectorLog -RedirectStandardError $injectorErrorLog -PassThru
  } finally { $env:CODEX_TODO_DATA_DIR = $previous }
}

Write-Log "Supervisor started."
$unhealthySince = $null
try {
  while ($true) {
    try {
      $service = Get-NodeProcess $serviceEntry
      if (-not $service) {
        $started = Start-ServiceProcess
        Write-Log "Service started with PID $($started.Id)."
        $unhealthySince = $null
        Start-Sleep -Seconds 2
      } elseif (Test-Health) {
        $unhealthySince = $null
      } elseif (-not $unhealthySince) {
        $unhealthySince = Get-Date
      } elseif (((Get-Date) - $unhealthySince).TotalSeconds -ge 8) {
        Write-Log "Service unhealthy; restarting PID $($service.ProcessId)."
        Stop-Process -Id $service.ProcessId -Force -ErrorAction SilentlyContinue
        $unhealthySince = $null
      }

      $injector = Get-NodeProcess $injectorEntry
      if (-not $injector) {
        $started = Start-InjectorProcess
        Write-Log "Injector started with PID $($started.Id)."
      }
    } catch { Write-Log "Health loop error: $($_.Exception.Message)" }
    Start-Sleep -Seconds 2
  }
} finally {
  Write-Log "Supervisor stopped."
  try { $mutex.ReleaseMutex() } catch {}
  $mutex.Dispose()
}
