import { defineConfig } from "vite";
import swc from "@rollup/plugin-swc";

// https://vitejs.dev/config
export default defineConfig({
  optimizeDeps: {
    exclude: ["pdf-parse"], // 防止预打包 pdf-parse
  },
  build: {
    rollupOptions: {
      external: ["pdf-parse"], // 确保 pdf-parse 不被打包到 bundle 里
    },
  },
  plugins: [swc()],
  esbuild: false,
});
