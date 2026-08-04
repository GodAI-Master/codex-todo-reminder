(() => {
  "use strict";
  const VERSION = "0.1.1";
  const SOURCE_HASH = String(window.__CODEX_TODO_SOURCE_HASH__ || VERSION);
  const SENTINEL = "__CODEX_TODO_PANEL__";
  const ENTRY_ID = "codex-todo-reminder-entry";
  const TASKBOARD_ENTRY_ID = "codex-taskboard-entry";
  const PAGE_ID = "codex-todo-reminder-page";
  const FRAME_ID = "codex-todo-reminder-frame";
  const STATUS_ID = "codex-todo-reminder-status";
  const STYLE_ID = "codex-todo-reminder-style";
  const OWNED = "data-codex-todo-owned";
  const HIDDEN = "data-codex-todo-hidden";
  const HOST = "data-codex-todo-host";
  const NATIVE_SELECTED = "data-codex-todo-native-selected";
  const REATTACH_DELAY = 80;
  const PANEL_URL = String(window.__CODEX_TODO_URL__ || "http://127.0.0.1:47831/panel/");
  const PLUGIN_LABELS = ["插件", "plugins", "plugin"];

  const previous = window[SENTINEL];
  if (previous?.sourceHash === SOURCE_HASH) {
    previous.refresh?.();
    if (window.__CODEX_TODO_OPEN_ON_INJECT__) previous.open?.();
    return;
  }
  previous?.destroy?.();

  let entry = null;
  let page = null;
  let frame = null;
  let status = null;
  let observer = null;
  let active = false;
  let destroyed = false;
  let timer = null;
  const mutedSelections = new Map();

  function label(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function currentTheme() {
    const root = document.documentElement;
    const explicit = String(root.dataset.theme || root.getAttribute("data-color-theme") || "").toLowerCase();
    if (explicit.includes("dark") || root.classList.contains("dark")) return "dark";
    if (explicit.includes("light") || root.classList.contains("light")) return "light";
    try { return getComputedStyle(root).colorScheme.includes("dark") ? "dark" : "light"; }
    catch { return "light"; }
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute(OWNED, "true");
    style.textContent = `
      #${ENTRY_ID}[aria-current="page"] {
        background: var(--color-token-list-hover-background, color-mix(in srgb,currentColor 8%,transparent));
        color: var(--color-token-foreground, inherit);
      }
      #${ENTRY_ID}:focus-visible { outline: 2px solid var(--color-token-border,Highlight); outline-offset: 2px; }
      [${HOST}="true"] { position: relative !important; z-index: 31 !important; pointer-events: none !important; }
      [${HIDDEN}="true"] { visibility: hidden !important; pointer-events: none !important; }
      [${NATIVE_SELECTED}="true"] { background-color: transparent !important; }
      #${PAGE_ID} { position: absolute; inset: 0; z-index: 2; min-width: 0; min-height: 0; overflow: hidden; background: Canvas; color: CanvasText; pointer-events: auto; }
      #${PAGE_ID}[hidden], #${FRAME_ID}[hidden], #${STATUS_ID}[hidden] { display: none !important; }
      #${FRAME_ID} { display: block; width: 100%; height: 100%; border: 0; background: Canvas; }
      #${STATUS_ID} { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; color: var(--color-token-text-secondary, color-mix(in srgb,CanvasText 60%,transparent)); font: 13px/1.5 system-ui,sans-serif; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function findReferenceButton() {
    const scroll = document.querySelector("[data-app-action-sidebar-scroll]");
    if (!scroll) return null;
    const buttons = Array.from(scroll.querySelectorAll("button"));
    const plugin = buttons.find((button) => PLUGIN_LABELS.includes(label(button.textContent || button.getAttribute("aria-label"))));
    if (plugin?.parentElement) return plugin;
    const group = Array.from(scroll.querySelectorAll("div")).find((element) => (
      Array.from(element.children).filter((child) => child.tagName === "BUTTON").length >= 3
    ));
    return Array.from(group?.children || []).filter((child) => child.tagName === "BUTTON").at(-1) || null;
  }

  function replaceIcon(button) {
    const svg = button.querySelector("svg");
    if (!svg) return;
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = '<rect x="4" y="3.5" width="16" height="17" rx="3"></rect><path d="m8 9 1.5 1.5L12 8M14.5 9H17M8 15l1.5 1.5L12 14M14.5 15H17"></path>';
  }

  function createEntry(reference) {
    const button = reference.cloneNode(true);
    button.id = ENTRY_ID;
    button.type = "button";
    for (const attr of ["disabled", "aria-expanded", "aria-controls", "aria-describedby", "data-state"]) button.removeAttribute(attr);
    button.setAttribute("aria-label", "打开待办任务");
    button.setAttribute("title", "待办任务");
    button.setAttribute(OWNED, "true");
    button.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    const spans = Array.from(button.querySelectorAll("span"));
    const text = button.querySelector(".text-fade-truncate") || spans.find((node) => PLUGIN_LABELS.includes(label(node.textContent)));
    if (text) text.textContent = "待办任务";
    else button.textContent = "待办任务";
    replaceIcon(button);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      open();
    });
    return button;
  }

  function ensureEntry() {
    if (destroyed || !document.body) return;
    installStyles();
    const reference = findReferenceButton();
    if (!reference?.parentElement) return;
    if (!entry) entry = createEntry(reference);
    const taskboardEntry = document.getElementById(TASKBOARD_ENTRY_ID);
    const anchor = taskboardEntry?.parentElement === reference.parentElement ? taskboardEntry : reference;
    if (entry.parentElement !== anchor.parentElement || entry.previousElementSibling !== anchor) anchor.after(entry);
    if (active) entry.setAttribute("aria-current", "page");
    else entry.removeAttribute("aria-current");
  }

  function findPageMount() {
    const frameHost = document.querySelector(".app-shell-main-content-frame");
    const viewport = frameHost?.closest?.("[data-app-shell-main-content-layout]")
      || document.querySelector("[data-app-shell-main-content-layout]");
    const surface = viewport?.parentElement;
    if (!viewport || !surface || !surface.closest("main")) return null;
    return { viewport, surface };
  }

  function createPage() {
    const section = document.createElement("section");
    section.id = PAGE_ID;
    section.hidden = true;
    section.setAttribute(OWNED, "true");
    section.setAttribute("role", "region");
    section.setAttribute("aria-label", "待办任务");
    status = document.createElement("div");
    status.id = STATUS_ID;
    status.textContent = "正在连接待办提醒服务…";
    section.appendChild(status);
    return section;
  }

  function panelUrl() {
    const url = new URL(PANEL_URL);
    url.searchParams.set("theme", currentTheme());
    return url.href;
  }

  function loadFrame() {
    frame?.remove();
    const next = document.createElement("iframe");
    next.id = FRAME_ID;
    next.title = "待办任务";
    next.referrerPolicy = "no-referrer";
    next.src = panelUrl();
    next.hidden = true;
    next.addEventListener("load", () => {
      if (status) status.hidden = true;
      next.hidden = false;
      postTheme();
    });
    frame = next;
    page.appendChild(next);
  }

  function postTheme() {
    frame?.contentWindow?.postMessage({ type: "codex-todo:theme", theme: currentTheme() }, "*");
  }

  function muteNative() {
    document.querySelectorAll('aside nav[role="navigation"] [aria-current]').forEach((node) => {
      if (node === entry || node.closest(`#${ENTRY_ID}`)) return;
      if (!mutedSelections.has(node)) mutedSelections.set(node, node.getAttribute("aria-current"));
      node.removeAttribute("aria-current");
      node.setAttribute(NATIVE_SELECTED, "true");
    });
  }

  function restoreNative() {
    document.querySelectorAll(`[${HIDDEN}="true"]`).forEach((node) => node.removeAttribute(HIDDEN));
    document.querySelectorAll(`[${HOST}="true"]`).forEach((node) => node.removeAttribute(HOST));
    for (const [node, value] of mutedSelections) {
      if (node.isConnected && value) node.setAttribute("aria-current", value);
      node.removeAttribute(NATIVE_SELECTED);
    }
    mutedSelections.clear();
  }

  function mountPage() {
    if (!active) return;
    if (!page) page = createPage();
    const mount = findPageMount();
    if (!mount) return;
    const { surface } = mount;
    if (page.parentElement !== surface) {
      restoreNative();
      surface.appendChild(page);
    }
    surface.setAttribute(HOST, "true");
    Array.from(surface.children).forEach((child) => {
      if (child !== page && child.getAttribute(OWNED) !== "true") child.setAttribute(HIDDEN, "true");
    });
    document.querySelectorAll('[data-testid="app-shell-header-context-menu-surface"]').forEach((header) => {
      Array.from(header.children).forEach((child) => child.setAttribute(HIDDEN, "true"));
    });
    muteNative();
    page.hidden = false;
    if (!frame) loadFrame();
  }

  function open() {
    active = true;
    ensureEntry();
    mountPage();
  }

  function close() {
    if (!active) return;
    active = false;
    if (page) page.hidden = true;
    restoreNative();
    ensureEntry();
  }

  function isNativeNavigation(target) {
    const button = target?.closest?.("button,a,[role='button'],[data-app-action-sidebar-thread-id]");
    return Boolean(button && button !== entry && !button.closest(`#${ENTRY_ID}`) && button.closest("aside nav[role='navigation']"));
  }

  function scheduleRefresh() {
    if (destroyed || timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      ensureEntry();
      mountPage();
      postTheme();
    }, REATTACH_DELAY);
  }

  function refresh() { ensureEntry(); mountPage(); postTheme(); }

  function destroy() {
    destroyed = true;
    if (timer !== null) clearTimeout(timer);
    observer?.disconnect();
    document.removeEventListener("click", onClick, true);
    close();
    document.querySelectorAll(`[${OWNED}="true"]`).forEach((node) => node.remove());
    if (window[SENTINEL] === api) delete window[SENTINEL];
  }

  function onClick(event) { if (active && isNativeNavigation(event.target)) close(); }

  const api = { version: VERSION, sourceHash: SOURCE_HASH, refresh, open, close, destroy };
  window[SENTINEL] = api;
  observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-theme", "data-color-theme", "aria-current"] });
  document.addEventListener("click", onClick, true);
  ensureEntry();
  if (window.__CODEX_TODO_OPEN_ON_INJECT__) open();
})();
