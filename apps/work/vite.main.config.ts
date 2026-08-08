import { resolve } from "path";
import swc from "@rollup/plugin-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
  plugins: [
    swc({
      swc: {
        inputSourceMap: false,
      },
    }),
  ],
  define: {
    // The main process bundle is CommonJS where import.meta.url is undefined;
    // node-cron's ESM build reads import.meta.url at module scope, so point it
    // at the real module file URL at runtime.
    "import.meta.url": "require('node:url').pathToFileURL(__filename).href",
  },
  resolve: {
    alias: {
      "@main": resolve(__dirname, "src/main"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    rollupOptions: {
      external: ["better-sqlite3"],
    },
  },
  esbuild: false,
  oxc: false,
});
