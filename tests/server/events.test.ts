import { describe, expect, it, vi } from "vitest";

import { EventBus } from "../../server/services/event-bus.js";

describe("event bus", () => {
  it("publishes changes and supports unsubscribe", () => {
    const events = new EventBus();
    const listener = vi.fn();
    const unsubscribe = events.subscribe(listener);
    events.emit({ type: "todo.changed", id: "todo-1" });
    unsubscribe();
    events.emit({ type: "todo.changed", id: "todo-2" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ type: "todo.changed", id: "todo-1" });
  });
});
