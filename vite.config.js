import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { transformSync, types as t } from "@babel/core";
import react from "@vitejs/plugin-react";
import { vitePrerenderPlugin } from "vite-prerender-plugin";

import { PRERENDERABLE_PUBLIC_ROUTES } from "./src/seo-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The crypto WASM URL is derived from the bundled module URL. Give the WASM
// artifact a per-build URL so a CDN/browser cannot reuse stale MIME headers.
const wasmBuildLabel = String(
  process.env.VITE_WASM_ASSET_BUILD_ID ||
    process.env.GITHUB_SHA ||
    process.env.PASSDEPLOYER_GIT_SHA ||
    "local",
)
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 12) || "local";
const wasmBuildId = `${wasmBuildLabel}-${Date.now().toString(36)}`;


function localizeJsxTextPlugin() {
  return {
    name: "paasdeployer-localize-jsx-text",
    enforce: "pre",
    transform(source, id) {
      const fileId = path.resolve(id.split("?")[0]).replace(/\\/g, "/");
      const sourceRoot = path.join(__dirname, "src").replace(/\\/g, "/") + "/";
      if (
        !fileId.startsWith(sourceRoot) ||
        !fileId.endsWith(".jsx") ||
        fileId.includes("/i18n/") ||
        fileId.includes("/scripts/")
      ) {
        return null;
      }

      let hasLocalizedText = false;
      const result = transformSync(source, {
        filename: fileId,
        babelrc: false,
        configFile: false,
        parserOpts: {
          sourceType: "module",
          plugins: ["jsx"],
        },
        generatorOpts: {
          retainLines: true,
          compact: false,
        },
        plugins: [
          function localizeVisibleJsxText() {
            return {
              visitor: {
                JSXText(jsxPath) {
                  let parent = jsxPath.parentPath;
                  while (parent && !parent.isJSXElement()) parent = parent.parentPath;
                  const parentName = parent?.node?.openingElement?.name;
                  const tagName = parentName?.type === "JSXIdentifier" ? parentName.name.toLowerCase() : "";
                  if (["code", "pre", "textarea", "script", "style"].includes(tagName)) return;

                  const value = String(jsxPath.node.value || "").replace(/\s+/g, " ");
                  if (!value.trim()) return;

                  hasLocalizedText = true;
                  const element = t.jsxElement(
                    t.jsxOpeningElement(
                      t.jsxIdentifier("LocalizedText"),
                      [t.jsxAttribute(t.jsxIdentifier("value"), t.stringLiteral(value))],
                      true,
                    ),
                    null,
                    [],
                    true,
                  );
                  jsxPath.replaceWith(t.jsxExpressionContainer(element));
                  jsxPath.skip();
                },
                Program: {
                  exit(programPath) {
                    if (!hasLocalizedText) return;
                    const declaration = t.importDeclaration(
                      [
                        t.importSpecifier(
                          t.identifier("LocalizedText"),
                          t.identifier("LocalizedText"),
                        ),
                      ],
                      t.stringLiteral("/src/i18n/LocalizedText.jsx"),
                    );
                    programPath.unshiftContainer("body", declaration);
                  },
                },
              },
            };
          },
        ],
      });

      if (!hasLocalizedText || !result) return null;
      return { code: result.code, map: result.map };
    },
  };
}

function emitSpaTemplate() {
  return {
    name: "paasdeployer-spa-template",
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
    localizeJsxTextPlugin(),
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
    outDir: "dist",
    sourcemap: false,
    cssCodeSplit: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          String(assetInfo.name || "").toLowerCase().endsWith(".wasm")
            ? `assets/[name]-[hash]-${wasmBuildId}[extname]`
            : "assets/[name]-[hash][extname]",
      },
    },
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !/(?:^|\/)prerender-[^/]+\.js$/.test(dep)),
    },
  },
});
