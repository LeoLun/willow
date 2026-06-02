import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const require = createRequire(import.meta.url);

const arch = process.argv[2];
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workDir = resolve(repoRoot, "app/work");
const rootNodeModules = resolve(repoRoot, "node_modules");

if (arch !== "x64" && arch !== "arm64") {
  console.error(`Unsupported macOS architecture: ${arch}`);
  process.exit(1);
}

const electronVersion = require(resolve(rootNodeModules, "electron/package.json")).version;

const copyRuntimeDependencies = (buildPath, _electronVersion, _platform, _arch, done) => {
  (async () => {
    const nodeModulesPath = resolve(buildPath, "node_modules");

    await mkdir(nodeModulesPath, { recursive: true });
    await cp(
      resolve(rootNodeModules, "better-sqlite3"),
      resolve(nodeModulesPath, "better-sqlite3"),
      { dereference: true, force: true, recursive: true },
    );
    await cp(resolve(rootNodeModules, "node-cron"), resolve(nodeModulesPath, "node-cron"), {
      dereference: true,
      force: true,
      recursive: true,
    });
    await cp(
      resolve(workDir, "src/renderer-floating-ball/.vite/renderer/floating_ball"),
      resolve(buildPath, ".vite/renderer/floating_ball"),
      { force: true, recursive: true },
    );
  })().then(() => done(), done);
};

const outputPaths = await packager({
  appBundleId: "com.willow.work",
  appCategoryType: "public.app-category.productivity",
  arch,
  asar: {
    unpack: "**/*.node",
  },
  derefSymlinks: true,
  dir: workDir,
  electronVersion,
  executableName: "Willow Work",
  icon: resolve(workDir, "assets/icons/icon"),
  ignore: [/^\/out\//],
  name: "Willow Work",
  out: resolve(workDir, "out"),
  overwrite: true,
  platform: "darwin",
  prune: false,
  quiet: false,
  afterCopy: [copyRuntimeDependencies],
});

console.log("Packaged app paths:");
for (const outputPath of outputPaths) {
  console.log(outputPath);
}
