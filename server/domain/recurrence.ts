export type RecurrencePreset = {
  kind: "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
  interval: number;
};

export function recurrenceToRRule(preset: RecurrencePreset): string {
  const interval = Math.max(1, Math.min(365, Math.trunc(preset.interval)));
  switch (preset.kind) {
    case "daily": return `FREQ=DAILY;INTERVAL=${interval}`;
    case "weekdays": return `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;INTERVAL=${interval}`;
    case "weekly": return `FREQ=WEEKLY;INTERVAL=${interval}`;
    case "monthly": return `FREQ=MONTHLY;INTERVAL=${interval}`;
    case "yearly": return `FREQ=YEARLY;INTERVAL=${interval}`;
  }
}

function parseRule(rule: string): Record<string, string> {
  return Object.fromEntries(rule.split(";").map((part) => {
    const [key, value] = part.split("=", 2);
    return [key?.toUpperCase() ?? "", value?.toUpperCase() ?? ""];
  }));
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addUtcMonths(date: Date, months: number): Date {
  const targetMonthStart = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
  targetMonthStart.setUTCDate(Math.min(date.getUTCDate(), daysInUtcMonth(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth(),
  )));
  return targetMonthStart;
}

export function nextOccurrence(rule: string, after: Date): Date | null {
  if (!Number.isFinite(after.getTime())) return null;
  const parsed = parseRule(rule);
  const interval = Math.max(1, Number.parseInt(parsed.INTERVAL ?? "1", 10) || 1);
  const next = new Date(after);
  switch (parsed.FREQ) {
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + interval);
      return next;
    case "WEEKLY":
      if (parsed.BYDAY === "MO,TU,WE,TH,FR") {
        do next.setUTCDate(next.getUTCDate() + 1);
        while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
        return next;
      }
      next.setUTCDate(next.getUTCDate() + 7 * interval);
      return next;
    case "MONTHLY":
      return addUtcMonths(next, interval);
    case "YEARLY":
      return addUtcMonths(next, interval * 12);
    default:
      return null;
  }
}
