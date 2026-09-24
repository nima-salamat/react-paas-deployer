import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
