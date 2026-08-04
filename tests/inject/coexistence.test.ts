import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

describe("Codex panel entry coexistence", () => {
  it("keeps the todo entry after the existing taskboard entry", () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>
      <aside><nav role="navigation"><div data-app-action-sidebar-scroll><div>
        <button><svg></svg><span>Home</span></button>
        <button><svg></svg><span>Skills</span></button>
        <button id="plugins-entry"><svg></svg><span class="text-fade-truncate">Plugins</span></button>
        <button id="codex-taskboard-entry"><svg></svg><span>Taskboard</span></button>
      </div></div></nav></aside>
      <main><div><div data-app-shell-main-content-layout><div class="app-shell-main-content-frame"></div></div></div></main>
    </body></html>`, { runScripts: "outside-only", url: "app://-/index.html" });
    const source = readFileSync(path.resolve("inject/codex-todo.user.js"), "utf8");
    dom.window.__CODEX_TODO_SOURCE_HASH__ = "coexistence-test";
    dom.window.__CODEX_TODO_URL__ = "http://127.0.0.1:47831/panel/#token=test";

    dom.window.eval(source);
    dom.window.eval(source);

    const taskboard = dom.window.document.getElementById("codex-taskboard-entry");
    expect(taskboard?.nextElementSibling?.id).toBe("codex-todo-reminder-entry");
    expect(dom.window.document.querySelectorAll("#codex-todo-reminder-entry")).toHaveLength(1);
    dom.window.close();
  });

  it("closes the taskboard before opening the todo panel", () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>
      <aside><nav role="navigation"><div data-app-action-sidebar-scroll><div>
        <button><svg></svg><span>Home</span></button>
        <button><svg></svg><span>Skills</span></button>
        <button><svg></svg><span class="text-fade-truncate">Plugins</span></button>
        <button id="codex-taskboard-entry"><svg></svg><span>Taskboard</span></button>
      </div></div></nav></aside>
      <main><div><div data-app-shell-main-content-layout><div class="app-shell-main-content-frame"></div></div></div></main>
    </body></html>`, { runScripts: "outside-only", url: "app://-/index.html" });
    const close = vi.fn();
    const source = readFileSync(path.resolve("inject/codex-todo.user.js"), "utf8");
    dom.window.__CODEX_TODO_SOURCE_HASH__ = "close-taskboard-test";
    dom.window.__CODEX_TODO_URL__ = "http://127.0.0.1:47831/panel/#token=test";
    dom.window.__codexTaskboardInjection__ = { close };

    dom.window.eval(source);
    dom.window.document.getElementById("codex-todo-reminder-entry")?.click();

    expect(close).toHaveBeenCalledWith(false);
    dom.window.close();
  });
});
