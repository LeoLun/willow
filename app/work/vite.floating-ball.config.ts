import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname + "/src/renderer-floating-ball",
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  plugins: [tailwindcss(), vue()],
  cacheDir: __dirname + "/node_modules/.vite-floating-ball",
});
