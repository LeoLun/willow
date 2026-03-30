import { defineConfig } from "tsup";

export default defineConfig(() => ({
  entry: ["src/index.ts"],
  minify: false,
  format: ["cjs", "esm"],
  target: "es2020",
  treeshake: true,
  silent: true,
  clean: true,
  dts: true,
  external: ["@mariozechner/pi-agent-core", "@mariozechner/pi-ai", "@sinclair/typebox"],
}));
