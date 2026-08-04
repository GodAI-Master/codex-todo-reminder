# Commands

```powershell
node scripts/todoctl.mjs add --title "整理项目总结" --due "2026-08-05T15:00:00+08:00" --remind "2026-08-05T14:30:00+08:00" --priority high
node scripts/todoctl.mjs list --view today
node scripts/todoctl.mjs get TODO-0001
node scripts/todoctl.mjs update TODO-0001 --due "2026-08-06T10:00:00+08:00"
node scripts/todoctl.mjs complete TODO-0001
node scripts/todoctl.mjs snooze TODO-0001 --minutes 10
node scripts/todoctl.mjs restore TODO-0001
node scripts/todoctl.mjs delete TODO-0001
```

Supported repeat values: `daily`, `weekdays`, `weekly`, `monthly`, `yearly`, `none`.
