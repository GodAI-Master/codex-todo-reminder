Option Explicit

Dim shell, fileSystem, scriptDirectory, handler, actionUri, expression, command
If WScript.Arguments.Count < 1 Then WScript.Quit 1
actionUri = WScript.Arguments(0)

Set expression = New RegExp
expression.Pattern = "^codex-todo-reminder://(open|complete|snooze)/[0-9a-fA-F-]{36}(\?minutes=(10|60))?$"
expression.IgnoreCase = True
If Not expression.Test(actionUri) Then WScript.Quit 2

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
handler = fileSystem.BuildPath(scriptDirectory, "handle-todo-action.ps1")
command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ _
  & handler & """ -Uri " & actionUri
shell.Run command, 0, False
