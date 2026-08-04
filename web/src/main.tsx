import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import "./styles.css";

const initialTheme = new URLSearchParams(window.location.search).get("theme")
  ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.dataset.theme = initialTheme === "dark" ? "dark" : "light";
window.addEventListener("message", (event) => {
  if (event.data?.type !== "codex-todo:theme") return;
  document.documentElement.dataset.theme = event.data.theme === "dark" ? "dark" : "light";
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
