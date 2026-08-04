param(
  [Parameter(Mandatory = $true)][string]$AppId,
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $true)][string]$Message,
  [Parameter(Mandatory = $true)][string]$OpenUri,
  [Parameter(Mandatory = $true)][string]$CompleteLabel,
  [Parameter(Mandatory = $true)][string]$SnoozeTenLabel,
  [Parameter(Mandatory = $true)][string]$SnoozeSixtyLabel,
  [Parameter(Mandatory = $true)][string]$CompleteUri,
  [Parameter(Mandatory = $true)][string]$SnoozeTenUri,
  [Parameter(Mandatory = $true)][string]$SnoozeSixtyUri,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

function Escape-Xml([string]$Value) {
  return [System.Security.SecurityElement]::Escape($Value)
}

[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$xml = @"
<toast launch="$(Escape-Xml $OpenUri)" activationType="protocol" duration="long">
  <visual>
    <binding template="ToastGeneric">
      <text>$(Escape-Xml $Title)</text>
      <text>$(Escape-Xml $Message)</text>
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.Reminder" />
  <actions>
    <action content="$(Escape-Xml $CompleteLabel)" arguments="$(Escape-Xml $CompleteUri)" activationType="protocol" />
    <action content="$(Escape-Xml $SnoozeTenLabel)" arguments="$(Escape-Xml $SnoozeTenUri)" activationType="protocol" />
    <action content="$(Escape-Xml $SnoozeSixtyLabel)" arguments="$(Escape-Xml $SnoozeSixtyUri)" activationType="protocol" />
  </actions>
</toast>
"@

$document = New-Object Windows.Data.Xml.Dom.XmlDocument
try { $document.LoadXml($xml) }
catch {
  if ($ValidateOnly) { Write-Error $xml }
  throw
}
$toast = [Windows.UI.Notifications.ToastNotification]::new($document)
if ($ValidateOnly) { exit 0 }
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)
