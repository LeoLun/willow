import { resolve } from "path";
import swc from "@rollup/plugin-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    swc({
      swc: {
        inputSourceMap: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@main": resolve(__dirname, "src/main"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    rollupOptions: {
      external: ["better-sqlite3", "bufferutil", "utf-8-validate"],
    },
  },
  esbuild: false,
});
