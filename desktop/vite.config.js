// @ts-nocheck
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// Proxy plugin to bypass browser CORS when crawling novel sites during dev
function novelCorsProxyPlugin() {
  return {
    name: "novel-cors-proxy",
    configureServer(server) {
      server.middlewares.use("/api/proxy", async (req, res) => {
        try {
          const urlObj = new URL(req.url, "http://127.0.0.1:1420");
          const targetUrl = urlObj.searchParams.get("url");

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing 'url' query parameter" }));
            return;
          }

          const response = await fetch(targetUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
            },
            redirect: "follow",
            signal: AbortSignal.timeout(15000)
          });

          const body = await response.text();
          res.setHeader("Content-Type", response.headers.get("content-type") || "text/html; charset=utf-8");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.statusCode = response.status;
          res.end(body);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [sveltekit(), novelCorsProxyPlugin()],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
