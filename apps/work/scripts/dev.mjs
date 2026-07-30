import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const forgePackagePath = require.resolve("@electron-forge/cli/package.json");
const forgePackage = require(forgePackagePath);
const forgeCliPath = resolve(dirname(forgePackagePath), forgePackage.bin["electron-forge"]);
const forgeArgs = process.argv.slice(2);

if (process.platform === "darwin") {
  const electronPath = require("electron");
  const electronResourcesPath = resolve(dirname(electronPath), "../Resources");
  mkdirSync(resolve(electronResourcesPath, "zh_CN.lproj"), { recursive: true });

  if (!forgeArgs.includes("--")) {
    forgeArgs.push("--");
  }
  forgeArgs.push("-AppleLanguages", '("zh-Hans")');
}

const child = spawn(process.execPath, [forgeCliPath, "start", ...forgeArgs], {
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error("Failed to start Electron Forge:", error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
