import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
