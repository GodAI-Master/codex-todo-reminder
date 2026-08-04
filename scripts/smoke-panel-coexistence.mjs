import { chromium } from "playwright";

const portIndex = process.argv.indexOf("--port");
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 9231);
const screenshotIndex = process.argv.indexOf("--screenshot");
const screenshotPath = screenshotIndex >= 0 ? process.argv[screenshotIndex + 1] : "";
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

try {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => candidate.url().startsWith("app://-/index.html") && !candidate.url().includes("avatar-overlay"));
  if (!page) throw new Error("No Codex page is available.");

  const taskboardEntry = page.locator("#codex-taskboard-entry");
  const todoEntry = page.locator("#codex-todo-reminder-entry");
  await taskboardEntry.waitFor({ state: "visible" });
  await todoEntry.waitFor({ state: "visible" });

  const panelState = (pageId, frameId, entryId) => page.evaluate(({ pageId, frameId, entryId }) => {
    const panel = document.getElementById(pageId);
    const frame = document.getElementById(frameId);
    const entry = document.getElementById(entryId);
    return {
      open: Boolean(panel && !panel.hidden && frame && !frame.hidden && entry?.getAttribute("aria-current") === "page"),
      pagePresent: Boolean(panel),
      pageHidden: panel?.hidden ?? null,
      framePresent: Boolean(frame),
      frameHidden: frame?.hidden ?? null,
      ariaCurrent: entry?.getAttribute("aria-current") ?? null,
    };
  }, { pageId, frameId, entryId });

  await taskboardEntry.click();
  await page.waitForTimeout(350);
  const firstTaskboardState = await panelState("codex-taskboard-page", "codex-taskboard-frame", "codex-taskboard-entry");
  const taskboardOpened = firstTaskboardState.open;

  await todoEntry.click();
  await page.waitForTimeout(350);
  const todoState = await panelState("codex-todo-reminder-page", "codex-todo-reminder-frame", "codex-todo-reminder-entry");
  const taskboardAfterTodo = await panelState("codex-taskboard-page", "codex-taskboard-frame", "codex-taskboard-entry");
  const todoOpened = todoState.open;
  const taskboardClosed = !taskboardAfterTodo.open;

  await taskboardEntry.click();
  await page.waitForTimeout(350);
  const finalTaskboardState = await panelState("codex-taskboard-page", "codex-taskboard-frame", "codex-taskboard-entry");
  const todoAfterTaskboard = await panelState("codex-todo-reminder-page", "codex-todo-reminder-frame", "codex-todo-reminder-entry");
  const taskboardReopened = finalTaskboardState.open;
  const todoClosed = !todoAfterTaskboard.open;

  const report = {
    ok: taskboardOpened && todoOpened && taskboardClosed && taskboardReopened && todoClosed,
    taskboardOpened,
    todoOpened,
    taskboardClosed,
    taskboardReopened,
    todoClosed,
    todoState,
    firstTaskboardState,
    finalTaskboardState,
  };
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await browser.close();
}
