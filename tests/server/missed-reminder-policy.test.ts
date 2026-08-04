import { describe, expect, it } from "vitest";

import { shouldDeliverMissedReminder } from "../../server/services/missed-reminder-policy.js";

describe("missed reminder policy", () => {
  it("delivers reminders within the recovery window", () => {
    expect(shouldDeliverMissedReminder(
      new Date("2026-08-04T07:30:00.000Z"),
      new Date("2026-08-04T08:00:00.000Z"),
      24 * 60,
    )).toBe(true);
  });

  it("skips notification spam outside the recovery window", () => {
    expect(shouldDeliverMissedReminder(
      new Date("2026-08-02T07:30:00.000Z"),
      new Date("2026-08-04T08:00:00.000Z"),
      24 * 60,
    )).toBe(false);
  });
});
