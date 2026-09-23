import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitePrerenderPlugin } from "vite-prerender-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRERENDER_ROUTES = [
  "/",
  "/plans",
  "/aboutUs",
];

export default defineConfig({
  plugins: [
    react(),
    vitePrerenderPlugin({
      renderTarget: "#root",
      prerenderScript: path.resolve(__dirname, "src/prerender.jsx"),
      additionalPrerenderRoutes: PRERENDER_ROUTES,
      previewMiddlewareEnabled: true,
      previewMiddlewareFallback: "/index.html",
    }),
  ],
  server: {
    host: true,
    proxy: {
      "/ws": {
        target: process.env.VITE_API_ORIGIN || "https://api.echonode.website",
        ws: true,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    cssCodeSplit: true,
    minify: "esbuild",
  },
});
