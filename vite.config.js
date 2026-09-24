import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitePrerenderPlugin } from "vite-prerender-plugin";

import { PRERENDERABLE_PUBLIC_ROUTES } from "./src/seo-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function emitSpaTemplate() {
  return {
    name: "passdeployer-spa-template",
    generateBundle(_options, bundle) {
      const indexEntry = bundle["index.html"];
      if (!indexEntry || indexEntry.type !== "asset") return;

      this.emitFile({
        type: "asset",
        fileName: "_template.html",
        source: String(indexEntry.source),
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      // vite-prerender-plugin executes the browser bundle in Node. Use
      // Emotion's universal ESM build so its SSR path never assumes document.
      "@emotion/cache": path.resolve(
        __dirname,
        "node_modules/@emotion/cache/dist/emotion-cache.esm.js",
      ),
    },
  },
  plugins: [
    react(),
    emitSpaTemplate(),
    vitePrerenderPlugin({
      renderTarget: "#root",
      prerenderScript: path.resolve(__dirname, "src/prerender.jsx"),
      additionalPrerenderRoutes: PRERENDERABLE_PUBLIC_ROUTES,
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
    sourcemap: true,
    outDir: "dist",
    sourcemap: false,
    cssCodeSplit: true,
    minify: "esbuild",
  },
});
