import { describe, expect, it } from "vitest";

import { nextOccurrence, recurrenceToRRule } from "../../server/domain/recurrence.js";

describe("recurrence", () => {
  it("supports daily and weekday schedules", () => {
    const after = new Date("2026-08-07T07:00:00.000Z");
    expect(nextOccurrence(recurrenceToRRule({ kind: "daily", interval: 1 }), after)?.toISOString())
      .toBe("2026-08-08T07:00:00.000Z");
    expect(nextOccurrence(recurrenceToRRule({ kind: "weekdays", interval: 1 }), after)?.toISOString())
      .toBe("2026-08-10T07:00:00.000Z");
  });

  it("supports weekly and monthly schedules", () => {
    const after = new Date("2026-08-31T02:00:00.000Z");
    expect(nextOccurrence(recurrenceToRRule({ kind: "weekly", interval: 2 }), after)?.toISOString())
      .toBe("2026-09-14T02:00:00.000Z");
    expect(nextOccurrence(recurrenceToRRule({ kind: "monthly", interval: 1 }), after)?.toISOString())
      .toBe("2026-09-30T02:00:00.000Z");
  });
});
