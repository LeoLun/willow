# 执行计划：修复 dev 模式下应用图标

## 变更概要

dev 模式下 `BrowserWindow` 未设置自定义图标，显示 Electron 默认图标。

## 实现步骤

### 1. 在 `main.window.ts` 的 options 中添加 `icon` 属性

**文件**: `app/work/src/main/window/main.window.ts`  
**改动**: 在 `options` 对象末尾（`webPreferences` 之后）添加一行 `icon`，仅在 dev 模式下生效。

**具体操作**:
```ts
// 利用 MAIN_WINDOW_VITE_DEV_SERVER_URL 常量区分 dev/生产（已在此文件中使用）
// dev 模式: __dirname 指向 .vite/build/ → ../../assets/icons/icon.png 即项目根 icons 目录
// 生产模式: 不设置，由 packagerConfig.icon 处理
```

改动后完整的 `options`:
```ts
options: {
  height: 800,
  width: 1200,
  titleBarStyle: "hiddenInset",
  trafficLightPosition: { x: 10, y: 12 },
  webPreferences: {
    preload: join(__dirname, "preload.js"),
    webSecurity: false,
  },
  ...(MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? { icon: join(__dirname, "../../assets/icons/icon.png") }
    : {}),
},
```

### 2. 验证

- 执行 `pnpm dev`，确认 Dock/任务栏中显示的是 Willow 自定义图标而非 Electron 默认图标
- 确认生产构建 `pnpm build` 不受影响（options 中 dev 条件不触发）

## 风险

- 无。改动仅影响 dev 模式，使用已有代码模式（`MAIN_WINDOW_VITE_DEV_SERVER_URL` 判断 + `join(__dirname, ...)` 路径解析），不触及生产路径。
