$ErrorActionPreference = "Stop"
$baseUrl = "http://127.0.0.1:47831"
$localRoot = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "CodexTodoReminder" } else { Join-Path $env:USERPROFILE "AppData\Local\CodexTodoReminder" }
$auth = Get-Content -Raw -LiteralPath (Join-Path $localRoot "config\auth.json") -Encoding UTF8 | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($auth.token)"; Origin = $baseUrl }
$protocol = (Get-Item "Registry::HKEY_CURRENT_USER\Software\Classes\codex-todo-reminder\shell\open\command").GetValue("")
$created = @()

function New-TestTodo([string]$Title) {
  $due = (Get-Date).AddDays(1).ToUniversalTime().ToString("o")
  $body = @{ title = $Title; dueAt = $due; reminderAt = $due } | ConvertTo-Json -Compress
  return Invoke-RestMethod -Method Post -Uri "$baseUrl/api/todos" -Headers $headers -ContentType "application/json" -Body $body
}

try {
  $completeTodo = New-TestTodo "notification-complete-smoke"
  $created += $completeTodo.id
  Start-Process "codex-todo-reminder://complete/$($completeTodo.id)"
  $deadline = (Get-Date).AddSeconds(12)
  do {
    Start-Sleep -Milliseconds 200
    $current = Invoke-RestMethod -Uri "$baseUrl/api/todos/$($completeTodo.id)" -Headers $headers
  } while ($current.status -ne "completed" -and (Get-Date) -lt $deadline)

  $snoozeTodo = New-TestTodo "notification-snooze-smoke"
  $created += $snoozeTodo.id
  Start-Process "codex-todo-reminder://snooze/$($snoozeTodo.id)?minutes=10"
  $deadline = (Get-Date).AddSeconds(12)
  $matched = $false
  do {
    Start-Sleep -Milliseconds 200
    $log = Get-Content -Raw -LiteralPath (Join-Path $localRoot "logs\notification-actions.log") -ErrorAction SilentlyContinue
    $matched = $log -match "success action=snooze todo=$([regex]::Escape($snoozeTodo.id)) minutes=10"
  } while (-not $matched -and (Get-Date) -lt $deadline)

  $report = [ordered]@{
    completeStatus = $current.status
    snoozeActionRecorded = $matched
    protocolUsesSilentHandler = $protocol -like "*wscript.exe*handle-todo-action.vbs*"
  }
  $report | ConvertTo-Json -Compress
  if ($report.Values -contains $false -or $current.status -ne "completed") { throw "Live notification protocol test failed." }
} finally {
  foreach ($id in $created) {
    try {
      Invoke-RestMethod -Method Delete -Uri "$baseUrl/api/todos/$id" -Headers $headers -ContentType "application/json" -Body "{}" | Out-Null
    } catch {}
  }
}
