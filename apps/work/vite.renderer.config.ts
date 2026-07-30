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
    exclude: [],
    include: [],
  },
  resolve: {
    alias: {
      "@willow/shadcn": resolve(__dirname, "../../packages/shadcn/src"),
      "@": resolve(__dirname, "src/renderer/src"),
      "@renderer": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
