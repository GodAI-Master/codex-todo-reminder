export async function listCodexTargets(origin) {
  const response = await fetch(`${origin}/json/list`, { signal: AbortSignal.timeout(1_500) });
  if (!response.ok) throw new Error(`CDP returned ${response.status}`);
  const targets = await response.json();
  return targets.filter((target) => target.type === "page"
    && String(target.url).startsWith("app://-/index.html")
    && !String(target.url).includes("avatar-overlay")
    && target.webSocketDebuggerUrl);
}

export async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CDP connection timed out")), 5_000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("CDP connection failed")); }, { once: true });
  });
  const id = 1;
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CDP evaluation timed out")), 8_000);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== id) return;
      clearTimeout(timeout);
      if (message.error) reject(new Error(message.error.message));
      else if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text || "CDP evaluation failed"));
      else resolve(message.result?.result?.value);
    });
    socket.send(JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: { expression, awaitPromise: true, returnByValue: true, userGesture: true },
    }));
  });
  socket.close();
  return result;
}
