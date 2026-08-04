export function shouldDeliverMissedReminder(
  scheduled: Date,
  now: Date,
  recoveryWindowMinutes: number,
): boolean {
  const age = now.getTime() - scheduled.getTime();
  return age >= 0 && age <= recoveryWindowMinutes * 60_000;
}
