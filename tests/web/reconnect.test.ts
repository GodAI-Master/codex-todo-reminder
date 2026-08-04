// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { reconnectDelay } from "../../web/src/hooks/useConnectionStatus.js";

describe("automatic reconnect", () => {
  it("uses bounded exponential backoff", () => {
    expect([0, 1, 2, 3, 4, 8].map(reconnectDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 15_000, 15_000]);
  });
});
