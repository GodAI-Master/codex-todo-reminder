Option Explicit

Dim shell, fileSystem, scriptDirectory, watchdog, debugPort, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
watchdog = fileSystem.BuildPath(scriptDirectory, "ensure-codex-todo-running.ps1")
debugPort = "9231"
If WScript.Arguments.Count > 0 Then debugPort = WScript.Arguments(0)

command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ _
  & watchdog & """ -DebugPort " & debugPort
shell.Run command, 0, False
