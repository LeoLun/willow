# 修复 dev 模式下应用图标未使用自定义图标

## 现状

生产模式下，`forge.config.mjs` 中的 `packagerConfig.icon` 会将 `app/work/assets/icons/` 下的图标打包进应用 bundle，Dock / 任务栏图标正常显示。

dev 模式下（`pnpm dev`），Electron 通过 electron-forge + Vite 直接启动，不会经过打包流程。`BrowserWindow` 创建时没有设置 `icon` 属性，导致窗口显示 Electron 默认图标，而非项目自定义图标。

项目已有图标文件：
- `app/work/assets/icons/icon.icns` — macOS
- `app/work/assets/icons/icon.ico` — Windows
- `app/work/assets/icons/icon.png` — Linux / 通用回退
- `app/work/assets/icons/icon.svg` — 矢量源文件

## 目标

dev 模式下 `BrowserWindow` 使用 `app/work/assets/icons/` 下的自定义图标。

## 方案

在 `main.window.ts` 的 `@Window` 装饰器选项中添加 `icon` 属性。dev 模式下通过 `__dirname` 解析到 `assets/icons/icon.png`。生产模式下不设置（由 packager 处理 bundle 图标）。
