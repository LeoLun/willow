import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    open: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  plugins: [tailwindcss(), vue()],
  optimizeDeps: {
    exclude: ["@willow/sender"],
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
      "@willow/shadcn": resolve(__dirname, "../../packages/shadcn/src"),
      "@willow/sender": resolve(__dirname, "../../packages/sender/src"),
      "@willow/ui": resolve(__dirname, "../../packages/ui/src"),
      "@": resolve(__dirname, "src"),
    },
  },
});
