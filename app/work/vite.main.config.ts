import { defineConfig } from "vite";
import swc from "@rollup/plugin-swc";
import { resolve } from "path";

// https://vitejs.dev/config
export default defineConfig({
  plugins: [swc()],
  resolve: {
    alias: {
      "@main": resolve(__dirname, "src/main"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  esbuild: false,
});
