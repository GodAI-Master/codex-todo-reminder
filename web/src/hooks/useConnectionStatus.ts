import { useEffect, useRef, useState } from "react";

import { localToken } from "../lib/api.js";

export type ConnectionStatus = "connecting" | "connected" | "offline";

export function reconnectDelay(attempt: number): number {
  return Math.min(15_000, 1_000 * (2 ** Math.max(0, attempt)));
}

export function useConnectionStatus(onChange: () => void): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    let closed = false;
    let source: EventSource | undefined;
    let timer: number | undefined;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      setStatus(attempt === 0 ? "connecting" : "offline");
      const query = localToken ? `?token=${encodeURIComponent(localToken)}` : "";
      source = new EventSource(`/api/events${query}`);
      source.addEventListener("ready", () => {
        attempt = 0;
        setStatus("connected");
      });
      source.addEventListener("change", () => callback.current());
      source.onerror = () => {
        source?.close();
        setStatus("offline");
        timer = window.setTimeout(connect, reconnectDelay(attempt++));
      };
    };

    connect();
    return () => {
      closed = true;
      source?.close();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return status;
}
