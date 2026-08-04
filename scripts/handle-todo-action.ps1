param(
  [Parameter(Mandatory = $true)][string]$Uri,
  [string]$DataDir = "",
  [string]$BaseUrl = "http://127.0.0.1:47831"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE "AppData\Local" }
if (-not $DataDir) { $DataDir = Join-Path $localAppData "CodexTodoReminder" }
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $DataDir "logs"
$logFile = Join-Path $logDirectory "notification-actions.log"

function Write-ActionLog([string]$Message) {
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  Add-Content -LiteralPath $logFile -Encoding UTF8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff') $Message"
}

try {
  $parsed = [Uri]$Uri
  if ($parsed.Scheme -ne "codex-todo-reminder") { throw "Unsupported notification action scheme." }
  $action = $parsed.Host.ToLowerInvariant()
  if ($action -notin @("open", "complete", "snooze")) { throw "Unsupported notification action." }
  $todoId = [Uri]::UnescapeDataString($parsed.AbsolutePath.Trim("/"))
  $parsedTodoId = [Guid]::Empty
  if (-not [Guid]::TryParse($todoId, [ref]$parsedTodoId)) { throw "Invalid todo identifier." }

  if ($action -eq "open") {
    $launcher = Join-Path $PSScriptRoot "start-codex-todo-windows.ps1"
    Start-Process -FilePath (Join-Path $PSHOME "powershell.exe") -ArgumentList @(
      "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", $launcher
    ) -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
    Write-ActionLog "success action=open todo=$todoId"
    exit 0
  }

  $minutes = 0
  if ($action -eq "snooze") {
    if ($parsed.Query -notmatch "(?:^|[?&])minutes=(10|60)(?:&|$)") { throw "Invalid snooze duration." }
    $minutes = [int]$Matches[1]
  }

  $authFile = Join-Path $DataDir "config\auth.json"
  if (-not (Test-Path -LiteralPath $authFile)) { throw "Local authorization is not ready." }
  $token = (Get-Content -Raw -LiteralPath $authFile -Encoding UTF8 | ConvertFrom-Json).token
  if (-not $token) { throw "Local authorization is invalid." }
  $headers = @{ Authorization = "Bearer $token"; Origin = $BaseUrl }

  $healthy = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    try {
      $health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 2
      if ($health.ok) { $healthy = $true; break }
    } catch {
      if ($attempt -eq 0 -and $BaseUrl -eq "http://127.0.0.1:47831") {
        & (Join-Path $PSScriptRoot "ensure-codex-todo-running.ps1") | Out-Null
      }
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $healthy) { throw "Todo service is unavailable." }

  if ($action -eq "complete") {
    $result = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/todos/$todoId/complete" -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 5
    Write-ActionLog "success action=complete todo=$todoId status=$($result.status) completedAt=$($result.completedAtUtc)"
  } else {
    $body = @{ minutes = $minutes } | ConvertTo-Json -Compress
    $result = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/todos/$todoId/snooze" -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 5
    Write-ActionLog "success action=snooze todo=$todoId minutes=$minutes snoozedUntil=$($result.snoozedUntilUtc)"
  }
} catch {
  $detail = $_.Exception.Message
  if ($_.ErrorDetails.Message) { $detail = "$detail response=$($_.ErrorDetails.Message)" }
  try {
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $responseBody = $reader.ReadToEnd()
      if ($responseBody) { $detail = "$detail response=$responseBody" }
    }
  } catch {}
  Write-ActionLog "failure uri=$Uri error=$detail"
  exit 1
}
