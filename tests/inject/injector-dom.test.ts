import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

describe("Codex todo injector", () => {
  it("adds one native-style entry and remains idempotent", () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>
      <aside><nav role="navigation"><div data-app-action-sidebar-scroll><div>
        <button><svg></svg><span>首页</span></button>
        <button><svg></svg><span>技能</span></button>
        <button><svg></svg><span class="text-fade-truncate">插件</span></button>
      </div></div></nav></aside>
      <main><div><div data-app-shell-main-content-layout><div class="app-shell-main-content-frame"></div></div></div></main>
    </body></html>`, { runScripts: "outside-only", url: "app://-/index.html" });
    const source = readFileSync(path.resolve("inject/codex-todo.user.js"), "utf8");
    dom.window.__CODEX_TODO_SOURCE_HASH__ = "test";
    dom.window.__CODEX_TODO_URL__ = "http://127.0.0.1:47831/panel/#token=test";
    dom.window.eval(source);
    dom.window.eval(source);

    expect(dom.window.document.querySelectorAll("#codex-todo-reminder-entry")).toHaveLength(1);
    expect(dom.window.document.querySelector("#codex-todo-reminder-entry")?.textContent).toContain("待办任务");
    dom.window.close();
  });
});
