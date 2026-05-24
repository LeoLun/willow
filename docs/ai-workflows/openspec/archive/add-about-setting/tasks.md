# 任务列表

## 1. 注册路由与设置菜单项目

- [ ] 修改 `app/work/src/renderer/src/pages/setting/Setting.vue`：
  - 从 `lucide-vue-next` 导入 `Info` 图标。
  - 在 `navItems` 数组中，在「配置」项下方，增加「关于」菜单项：
    ```typescript
    {
      label: "关于",
      icon: Info,
      routeName: "settingAbout",
      to: "/setting/about",
    }
    ```
- [ ] 修改 `app/work/src/renderer/src/router.ts`：
  - 导入 `AboutSetting.vue` 组件（可使用静态导入：`import AboutSetting from "./pages/setting/about/AboutSetting.vue";`）。
  - 在 `/setting` 路由的 `children` 数组中注册子路由 `about`：
    ```typescript
    { path: "about", name: "settingAbout", component: AboutSetting }
    ```

## 2. 新建 AboutSetting.vue 页面

- [ ] 创建目录 `app/work/src/renderer/src/pages/setting/about/`。
- [ ] 在该目录下创建 `AboutSetting.vue`。
- [ ] 实现组件的 `<script setup lang="ts">` 部分：
  - 导入所需要的组件：`Badge`、`Button`、`Progress`、`Tooltip`、`TooltipContent`、`TooltipTrigger`（从 `@willow/shadcn` 或 `@willow/shadcn/components/ui/*`）。
  - 导入所需的图标：`Info`、`Sparkles`（应用信息图标）、`RefreshCw`、`Download`、`ArrowUpCircle`、`AlertCircle`、`CheckCircle`。
  - 导入更新所用的 IPC 常量：`CHECK_UPDATE`, `START_DOWNLOAD`, `INSTALL_UPDATE`, `UPDATE_STATUS_CHANGED`。
  - 导入 EventBus 常量、API 类型、`electronAPI` 接口。
  - 定义并绑定更新的状态变量：`updateStatus`、`updateProgress`、`updateError`、`hasUpdate`、`currentVersion`、`latestVersion`、`updateType`、`releaseNotes`、`publishDate`。
  - 注册生命周期钩子，挂载时监听事件与静默检查，卸载时注销事件监听。
  - 实现核心操作函数：`handleCheckUpdate(silent)`、`handleStartDownload()`、`handleInstallUpdate()`。
- [ ] 实现 `<template>` 结构：
  - 页面大标题：`关于`。
  - 应用信息 Section：展示 Willow 应用 Logo、名称（Willow）、当前版本号 Badge、应用简介。
  - 系统更新 Section：搬运原 `ConfigurationSetting.vue` 的更新检测和更新状态面板，配合进度条、错误面板、日志面板显示。

## 3. 清理 ConfigurationSetting.vue

- [ ] 从 `ConfigurationSetting.vue` 的模板中删除 `系统更新` 的整个 `<section class="space-y-3">`。
- [ ] 从 `<script setup>` 中删除所有系统更新相关的：
  - 状态变量定义（如 `updateStatus`, `updateProgress`, `updateError` 等）。
  - 生命周期方法里有关 `UPDATE_STATUS_CHANGED` 的事件绑定和解绑逻辑，以及 `handleCheckUpdate(true)` 调用。
  - 业务处理函数 `handleCheckUpdate`、`handleStartDownload`、`handleInstallUpdate`。
- [ ] 清理未使用的 Imports：
  - 常量（`CHECK_UPDATE`, `START_DOWNLOAD`, `INSTALL_UPDATE`, `UPDATE_STATUS_CHANGED`）。
  - 类型定义（`CheckUpdateResponse`, `UpdateStatusPayload`）。
  - 图标（`RefreshCw`, `Download`, `ArrowUpCircle`, `AlertCircle`, `CheckCircle`，需确认有无其他地方使用，未使用则移除）。
  - `useEventBus`（如果该组件没有其他地方需要监听事件，则连同导入一并移除）。

## 4. 验证与测试

- [ ] 运行 `pnpm lint`，保证代码无 linter 警告/错误。
- [ ] 运行 `pnpm build` 或通过 `pnpm dev` 启动应用，检查：
  - 设置侧边栏是否成功出现「关于」项且点击能顺利跳转。
  - 关于页面的基础信息展示是否正确，当前版本是否能动态获取。
  - 点击“检查更新”按钮，交互是否正常，状态反馈是否灵敏。
  - 配置页面有无功能缺损，控制台是否有因残留代码引起的运行时报错。
