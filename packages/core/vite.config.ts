import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: (id) =>
        id.startsWith("node:") || id === "nunjucks" || id.startsWith("@earendil-works/"),
    },
    sourcemap: true,
    emptyOutDir: false,
  },
  server: {
    host: "127.0.0.1",
  },
  test: {
    environment: "node",
  },
});
