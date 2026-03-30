import { resolve } from "path";
import tailwindcss from "@tailwindcss/postcss";
import vue from "@vitejs/plugin-vue";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  server: {
    forwardConsole: {
      unhandledErrors: false,
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss() as any, autoprefixer()],
    },
  },
  plugins: [vue()],
  optimizeDeps: {
    include: [
      "highlight.js/lib/core",
      "highlight.js/lib/languages/bash",
      "highlight.js/lib/languages/css",
      "highlight.js/lib/languages/javascript",
      "highlight.js/lib/languages/json",
      "highlight.js/lib/languages/python",
      "highlight.js/lib/languages/sql",
      "highlight.js/lib/languages/typescript",
      "highlight.js/lib/languages/xml",
      "katex",
      "marked",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer/src"),
      "@renderer": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
