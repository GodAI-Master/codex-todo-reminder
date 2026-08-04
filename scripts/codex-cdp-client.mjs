export async function listCodexTargets(origin) {
  const response = await fetch(`${origin}/json/list`, { signal: AbortSignal.timeout(1_500) });
  if (!response.ok) throw new Error(`CDP returned ${response.status}`);
  const targets = await response.json();
  return targets.filter((target) => target.type === "page"
    && String(target.url).startsWith("app://-/index.html")
    && !String(target.url).includes("avatar-overlay")
    && target.webSocketDebuggerUrl);
}

export class CdpConnection {
  constructor(target, options = {}) {
    this.target = target;
    this.options = options;
    this.socket = null;
    this.sequence = 0;
    this.pending = new Map();
    this.closed = true;
  }

  async open() {
    if (!this.closed && this.socket?.readyState === WebSocket.OPEN) return;
    const socket = new WebSocket(this.target.webSocketDebuggerUrl);
    this.socket = socket;
    this.closed = false;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("CDP connection timed out")), 5_000);
      socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("CDP connection failed")); }, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(message.error.message));
      else if (message.result?.exceptionDetails) pending.reject(new Error(message.result.exceptionDetails.text || `CDP ${pending.method} failed`));
      else pending.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      this.closed = true;
      const error = new Error("CDP WebSocket closed");
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(error);
      }
      this.pending.clear();
    });
    if (this.options.bypassCSP) {
      await this.send("Page.enable");
      await this.send("Page.setBypassCSP", { enabled: true });
    }
  }

  send(method, params = {}, timeoutMs = this.options.timeoutMs ?? 8_000) {
    if (this.closed || this.socket?.readyState !== WebSocket.OPEN) throw new Error("CDP connection is not open");
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    return result?.result?.value;
  }

  close() {
    this.socket?.close();
    this.closed = true;
  }
}

export async function evaluate(target, expression, options = {}) {
  const connection = new CdpConnection(target, options);
  await connection.open();
  try { return await connection.evaluate(expression); }
  finally { connection.close(); }
}
