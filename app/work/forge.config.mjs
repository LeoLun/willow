import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const betterSqlite3Source = fileURLToPath(
  new URL("../../node_modules/better-sqlite3", import.meta.url),
);

const config = {
  packagerConfig: {
    asar: {
      unpack: "**/*.node",
    },
    appBundleId: "com.willow.work",
    appCategoryType: "public.app-category.productivity",
    executableName: "Willow Work",
    icon: "./assets/icons/icon",
    extraResource: ["./src/main/db/migrations", "./builtin-skills"],
  },
  rebuildConfig: {},
  hooks: {
    async packageAfterCopy(_forgeConfig, buildPath) {
      const packagedNodeModulesPath = join(buildPath, "node_modules");
      const packagedBetterSqlite3Path = join(packagedNodeModulesPath, "better-sqlite3");
      const packagedNodeCronPath = join(packagedNodeModulesPath, "node-cron");

      await mkdir(packagedNodeModulesPath, { recursive: true });
      await cp(betterSqlite3Source, packagedBetterSqlite3Path, {
        force: true,
        recursive: true,
      });
      await cp(
        fileURLToPath(new URL("../../node_modules/node-cron", import.meta.url)),
        packagedNodeCronPath,
        { force: true, recursive: true },
      );

      // Copy built floating_ball renderer files into package structure
      const srcFloatingBall = join(process.cwd(), "src/renderer-floating-ball/.vite/renderer/floating_ball");
      const destFloatingBall = join(buildPath, ".vite/renderer/floating_ball");
      await cp(srcFloatingBall, destFloatingBall, { force: true, recursive: true });
    },
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({
      name: "Willow Work",
      title: "Willow Work",
      format: "ULFO",
      overwrite: true,
      icon: "./assets/icons/icon.icns",
      window: {
        size: {
          width: 640,
          height: 480,
        },
      },
      contents: (options) => [
        {
          x: 152,
          y: 240,
          type: "file",
          path: options.appPath,
        },
        {
          x: 487,
          y: 240,
          type: "link",
          path: "/Applications",
        },
      ],
      background: fileURLToPath(new URL("assets/dmg-background.png", import.meta.url)),
    }),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
        {
          name: "floating_ball",
          config: "vite.floating-ball.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
