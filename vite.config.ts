import { AntdvNextResolver } from "@antdv-next/auto-import-resolver";
import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import Components from "unplugin-vue-components/vite";
import { defineConfig } from "vite";
import { mockDevServerPlugin } from "vite-plugin-mock-dev-server";

import pkg from "./package.json" with { type: "json" };
import { localIconAssetsPlugin } from "./build/local-icon-assets.ts";
import { storageNamespacePlugin } from "./build/storage-namespace.ts";

// Read installed versions so the About page describes this build, including pnpm symlinks.
const dependencyVersions = Object.fromEntries(
  Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).map((name) => {
    const manifest: { version?: unknown } = JSON.parse(
      readFileSync(new URL(`./node_modules/${name}/package.json`, import.meta.url), "utf8"),
    );
    if (typeof manifest.version !== "string") {
      throw new Error(`Missing installed version for ${name}`);
    }
    return [name, manifest.version];
  }),
);

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    APP_DEPENDENCY_VERSIONS: JSON.stringify(dependencyVersions),
  },
  plugins: [
    storageNamespacePlugin(),
    localIconAssetsPlugin(),
    vue(),
    Components({
      dts: false,
      resolvers: [
        AntdvNextResolver({
          // Match only wrapped components; string entries also match SelectOption/SelectOptGroup.
          exclude: /^(Select|DatePicker|DateRangePicker)$/,
        }),
      ],
    }),
    mockDevServerPlugin({
      prefix: "/api",
      log: "error",
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ["legacy-js-api"],
      },
      sass: {
        silenceDeprecations: ["legacy-js-api"],
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    // Scan the app's route graph, not lab/reference HTML with their own aliases.
    entries: ["index.html"],
    // Template/virtual imports may not be visible to the initial dependency scan.
    // The icon assets plugin also adds the configured lazy icon subpaths.
    include: ["antdv-next", "@antdv-next/icons", "@iconify/vue"],
  },
  server: {
    port: 3000,
    open: false,
    proxy: {},
  },
  build: {
    target: "chrome100",
    cssTarget: "chrome100",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/vue/") ||
            id.includes("node_modules/vue-router/") ||
            id.includes("node_modules/pinia/")
          ) {
            return "vue-vendor";
          }
          if (
            id.includes("node_modules/echarts/") ||
            id.includes("node_modules/vue-echarts/")
          ) {
            return "chart-vendor";
          }
        },
      },
    },
  },
});
