import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 47832,
    proxy: {
      "/api": "http://127.0.0.1:47831",
      "/health": "http://127.0.0.1:47831",
    },
  },
});
