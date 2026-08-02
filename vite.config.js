import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createHtmlPlugin } from "vite-plugin-html";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            VITE_APP_NAME: env.VITE_APP_NAME || "PassDeployer",
            VITE_APP_DESCRIPTION:
              env.VITE_APP_DESCRIPTION || "Deploy applications easily.",
            VITE_APP_URL:
              env.VITE_APP_URL || "https://echonode.website",
            VITE_APP_PREVIEW:
              env.VITE_APP_PREVIEW ||
              "https://echonode.website/preview.png",
          },
        },
      }),
    ],
  };
});