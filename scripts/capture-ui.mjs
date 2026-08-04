import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
].filter(Boolean);
const chrome = chromeCandidates.find(existsSync);
if (!chrome) throw new Error("Chrome was not found. Set CHROME_PATH and retry.");
const base = new URL(process.env.CODEX_TODO_URL ?? "http://127.0.0.1:47831/panel/");
if (!base.hash) {
  const dataDir = process.env.CODEX_TODO_DATA_DIR
    ?? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "CodexTodoReminder");
  const authFile = path.join(dataDir, "config", "auth.json");
  if (existsSync(authFile)) base.hash = new URLSearchParams({ token: JSON.parse(readFileSync(authFile, "utf8")).token }).toString();
}
const browser = await chromium.launch({ executablePath: chrome, headless: true });

for (const [name, viewport, theme, openSettings] of [
  ["todo-panel-wide.png", { width: 1280, height: 900 }, "light", false],
  ["todo-panel-narrow.png", { width: 470, height: 860 }, "light", false],
  ["todo-panel-dark.png", { width: 1280, height: 900 }, "dark", false],
  ["todo-panel-settings.png", { width: 1280, height: 900 }, "light", true],
]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const pageUrl = new URL(base);
  pageUrl.searchParams.set("theme", theme);
  await page.goto(pageUrl.href, { waitUntil: "networkidle" });
  if (openSettings) {
    await page.getByRole("button", { name: "设置与备份" }).click();
    await page.locator(".settings-page").waitFor({ state: "visible" });
  } else {
    await page.locator(".todo-card, .empty-state").first().waitFor({ state: "visible" });
  }
  await page.screenshot({ path: path.resolve("docs/assets", name), fullPage: true });
  await page.close();
}

await browser.close();
console.log("UI screenshots captured.");
