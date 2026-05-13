import { defineConfig } from "tsup";

export default defineConfig(() => ({
  entry: ["src/index.ts"],
  minify: false,
  format: ["cjs", "esm"],
  target: "es2018",
  treeshake: true,
  silent: true,
  clean: true,
  dts: true,
  external: ["electron", "tsyringe", "inversify", "reflect-metadata"],
}));
