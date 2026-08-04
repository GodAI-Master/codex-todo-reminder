export function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const reference = rest[0] && !rest[0].startsWith("--") ? rest.shift() : undefined;
  const flags = {};
  const positionals = [];
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) { positionals.push(value); continue; }
    const [rawKey, inline] = value.slice(2).split("=", 2);
    const next = inline ?? rest[index + 1];
    if (inline === undefined && next !== undefined && !next.startsWith("--")) index += 1;
    flags[rawKey] = next === undefined || next.startsWith("--") ? true : next;
  }
  return { command, reference, positionals, flags };
}

export function recurrenceFromFlag(value) {
  if (!value) return undefined;
  const aliases = { weekday: "weekdays", weekdays: "weekdays", day: "daily", week: "weekly", month: "monthly", year: "yearly" };
  const kind = aliases[value] ?? value;
  if (!["daily", "weekdays", "weekly", "monthly", "yearly"].includes(kind)) {
    throw new Error("--repeat must be daily, weekdays, weekly, monthly, or yearly");
  }
  return { kind, interval: 1 };
}

export function todoPayload(flags, { partial = false } = {}) {
  const payload = {};
  if (!partial || flags.title !== undefined) payload.title = String(flags.title ?? "").trim();
  if (flags.notes !== undefined) payload.notes = String(flags.notes);
  if (flags.priority !== undefined) payload.priority = String(flags.priority);
  if (flags.list !== undefined) payload.listId = flags.list === "none" ? null : String(flags.list);
  if (flags.due !== undefined) payload.dueAt = flags.due === "none" ? null : new Date(String(flags.due)).toISOString();
  if (flags.remind !== undefined) payload.reminderAt = flags.remind === "none" ? null : new Date(String(flags.remind)).toISOString();
  if (flags.timezone !== undefined) payload.timezone = String(flags.timezone);
  if (flags.repeat !== undefined) payload.recurrence = flags.repeat === "none" ? null : recurrenceFromFlag(String(flags.repeat));
  return payload;
}
