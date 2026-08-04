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
      visibility: panel ? getComputedStyle(panel).visibility : null,
      taskboardMask: panel?.getAttribute("data-codex-taskboard-native-hidden") ?? null,
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
  const todoFrameHandle = await page.locator("#codex-todo-reminder-frame").elementHandle();
  const todoContentFrame = await todoFrameHandle?.contentFrame();
  const todoContent = todoContentFrame ? {
    url: String(await todoContentFrame.evaluate(() => location.href).catch(() => todoContentFrame.url())).replace(/#.*$/, "#token=hidden"),
    title: await todoContentFrame.title().catch(() => ""),
    bodyText: (await todoContentFrame.locator("body").innerText().catch(() => "")).slice(0, 240),
  } : null;
  const taskboardAfterTodo = await panelState("codex-taskboard-page", "codex-taskboard-frame", "codex-taskboard-entry");
  const taskboardRootOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-codex-taskboard-open"));
  const todoOpened = todoState.open;
  const taskboardClosed = !taskboardAfterTodo.open && taskboardAfterTodo.pageHidden === true && !taskboardRootOpen;
  const todoVisible = todoState.visibility === "visible" && todoState.taskboardMask === null;

  await taskboardEntry.click();
  await page.waitForTimeout(350);
  const finalTaskboardState = await panelState("codex-taskboard-page", "codex-taskboard-frame", "codex-taskboard-entry");
  const todoAfterTaskboard = await panelState("codex-todo-reminder-page", "codex-todo-reminder-frame", "codex-todo-reminder-entry");
  const taskboardReopened = finalTaskboardState.open;
  const todoClosed = !todoAfterTaskboard.open;
  const switchCycles = [];
  for (let index = 0; index < 6; index += 1) {
    await todoEntry.click();
    await page.waitForTimeout(220);
    const currentTodo = await panelState("codex-todo-reminder-page", "codex-todo-reminder-frame", "codex-todo-reminder-entry");
    const currentTaskboard = await panelState("codex-taskboard-page", "codex-taskboard-frame", "codex-taskboard-entry");
    const rootOpen = await page.evaluate(() => document.documentElement.hasAttribute("data-codex-taskboard-open"));
    const todoOk = currentTodo.open && currentTodo.visibility === "visible" && currentTodo.taskboardMask === null
      && currentTaskboard.pageHidden === true && !rootOpen;
    await taskboardEntry.click();
    await page.waitForTimeout(220);
    const reopenedTaskboard = await panelState("codex-taskboard-page", "codex-taskboard-frame", "codex-taskboard-entry");
    const cycleOk = todoOk && reopenedTaskboard.open;
    switchCycles.push({ cycle: index + 1, ok: cycleOk });
  }
  const switchingStable = switchCycles.every((cycle) => cycle.ok);

  const report = {
    ok: taskboardOpened && todoOpened && todoVisible && taskboardClosed && taskboardReopened && todoClosed && switchingStable
      && Boolean(todoContent?.url.startsWith("http://127.0.0.1:47831/panel/"))
      && !todoContent?.bodyText.includes("该内容被屏蔽了"),
    taskboardOpened,
    todoOpened,
    todoVisible,
    taskboardClosed,
    taskboardReopened,
    todoClosed,
    switchingStable,
    switchCycles,
    todoState,
    todoContent,
    firstTaskboardState,
    finalTaskboardState,
  };
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await browser.close();
}
