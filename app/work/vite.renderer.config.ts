import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  server: {
    host: "127.0.0.1",
    forwardConsole: {
      unhandledErrors: false,
    },
  },
  preview: {
    host: "127.0.0.1",
  },
  plugins: [tailwindcss(), vue()],
  optimizeDeps: {
    exclude: ["@willow/sender", "@willow/ui"],
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
      "@": resolve(__dirname, "src/renderer/src"),
      "@renderer": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
