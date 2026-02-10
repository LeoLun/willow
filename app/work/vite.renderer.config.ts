import { defineConfig } from "vite";
import { resolve } from "path";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

// https://vitejs.dev/config
export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss() as any, autoprefixer()],
    },
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer/src"),
      "@renderer": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
