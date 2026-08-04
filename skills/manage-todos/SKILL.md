---
name: manage-todos
description: Manage the standalone Codex Todo Reminder. Use when the user asks to create, list, update, complete, snooze, restore, or delete personal todo reminders.
---

# Manage Todo Reminders

Use the local `todoctl` command in this skill's project to manage the user's independent todo reminder panel.

## Rules

1. Convert dates to an explicit ISO 8601 timestamp with the user's local offset before calling the tool.
2. If a date is materially ambiguous, ask one short clarification question instead of guessing.
3. After every write, report the returned `displayId`, title, due time, and reminder time.
4. Never delete multiple todos without explicit user confirmation.
5. Prefer `TODO-0001` display IDs in user-facing replies.

## Command

Run from the installed project directory:

```powershell
node scripts/todoctl.mjs <command> [options]
```

Read `references/commands.md` for exact examples.
