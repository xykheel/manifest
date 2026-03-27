import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

/** Browser → Vite (same origin); Vite forwards to API. Avoids cross-site refresh cookies (e.g. Firefox). */
const apiProxyTarget = process.env.VITE_DEV_PROXY_TARGET ?? "http://127.0.0.1:3001";
const apiProxy = {
  "/api": {
    target: apiProxyTarget,
    changeOrigin: true,
    /** Strip Domain from Set-Cookie so the browser pins the cookie to the dev server host (5173). */
    cookieDomainRewrite: "",
  },
} as const;

export default defineConfig({
  resolve: {
    alias: {
      "@manifest/shared": path.resolve(webRoot, "../../packages/shared/src/index.ts"),
    },
  },
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
  },
});
