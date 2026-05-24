# 执行计划：设置页面添加「关于」并迁移系统更新

本文档是将 OpenSpec 规范中关于“添加关于页面”和“系统更新迁移”的任务细化为具体开发与校验流程的执行计划。

---

## Slice 1: 注册路由与设置菜单项

### 1.1 增加「关于」菜单项
**文件**: `app/work/src/renderer/src/pages/setting/Setting.vue`

- 引入图标：自 `lucide-vue-next` 导入 `Info` 图标。
- 更新 `navItems` 数组，在“配置”项下方追加“关于”项：
  ```diff
    const navItems = [
      {
        label: "外观",
        icon: Sun,
        routeName: "settingAppearance",
        to: "/setting/appearance",
      },
      {
        label: "配置",
        icon: Settings2,
        routeName: "settingConfiguration",
        to: "/setting/configuration",
      },
  +   {
  +     label: "关于",
  +     icon: Info,
  +     routeName: "settingAbout",
  +     to: "/setting/about",
  +   },
    ];
  ```

### 1.2 注册子路由
**文件**: `app/work/src/renderer/src/router.ts`

- 静态导入 `AboutSetting.vue` 组件：
  ```diff
  + import AboutSetting from "./pages/setting/about/AboutSetting.vue";
  ```
- 在 `/setting` 路由的 `children` 数组中添加关于页面子路由：
  ```diff
      children: [
        { path: "appearance", name: "settingAppearance", component: AppearanceSetting },
        { path: "configuration", name: "settingConfiguration", component: ConfigurationSetting },
  +     { path: "about", name: "settingAbout", component: AboutSetting },
      ],
  ```

---

## Slice 2: 新建 AboutSetting.vue 页面

### 2.1 创建页面目录与组件文件
**文件路径**: `app/work/src/renderer/src/pages/setting/about/AboutSetting.vue`

- 创建对应的文件夹 `about`。
- 创建新组件 `AboutSetting.vue`。

### 2.2 实现脚本逻辑 (`<script setup lang="ts">`)
- 导入依赖库与组件：
  - `Badge`、`Button`、`Progress`、`Tooltip`、`TooltipContent`、`TooltipTrigger`
  - 图标：`Info`、`Sparkles`、`RefreshCw`、`Download`、`ArrowUpCircle`、`AlertCircle`、`CheckCircle`
  - 辅助逻辑与 API：`useEventBus`、`electronAPI`
  - 常量：`CHECK_UPDATE`、`START_DOWNLOAD`、`INSTALL_UPDATE`、`UPDATE_STATUS_CHANGED` 自 `@shared/constants`
  - 类型：`UpdateStatusPayload` 自 `@shared/api`
- 定义并绑定更新的状态变量：
  - `updateStatus`、`updateProgress`、`updateError`、`hasUpdate`、`currentVersion`、`latestVersion`、`updateType`、`releaseNotes`、`publishDate`。
- 事件监听生命周期挂载：
  - 在 `onMounted` 钩子中注册对 `UPDATE_STATUS_CHANGED` 的事件绑定，并执行静默检查 `handleCheckUpdate(true)`。
  - 在 `onUnmounted` 钩子中解除事件绑定。
- 实现核心动作方法：
  - `handleCheckUpdate(silent)`：如果非静默，先清空 `updateError.value`。之后调用 `electronAPI.checkUpdate()`。
  - `handleStartDownload()`：调用 `electronAPI.startDownload()`。
  - `handleInstallUpdate()`：调用 `electronAPI.installUpdate()`。

### 2.3 实现模板 UI
- 大标题为“关于”。
- 应用信息 Section：使用细边框卡片展示 `Sparkles` 图标、加粗的应用名称 `Willow`、当前版本 `Badge`（显示 `currentVersion || 'v0.0.1'`）以及应用简介。
- 系统更新 Section：搬移原 `ConfigurationSetting.vue` 中的系统更新模板（行 338-462），维持现有视觉样式与功能（按钮、进度条、错误提示、日志面板）。

---

## Slice 3: 清理 ConfigurationSetting.vue 中的系统更新逻辑

### 3.1 清理 HTML 模板
**文件**: `app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue`

- 移除包含 `<h2 class="text-base font-medium">系统更新</h2>` 的整个 `<section class="space-y-3">` 段落（即文件底部的系统更新部分）。

### 3.2 清理脚本中的逻辑代码
- 移除以下更新状态响应式变量：
  - `updateStatus`、`updateProgress`、`updateError`、`hasUpdate`、`currentVersion`、`latestVersion`、`updateType`、`releaseNotes`、`publishDate`。
- 移除事件监听方法：
  - `handleUpdateStatusChanged` 声明。
  - `onMounted` 钩子中对 `UPDATE_STATUS_CHANGED` 的监听注册以及 `handleCheckUpdate(true)` 的调用。
  - `onUnmounted` 钩子中对事件的注销。
- 移除更新处理函数：
  - `handleCheckUpdate`、`handleStartDownload`、`handleInstallUpdate`。

### 3.3 清理未使用的 Imports
- 删除未使用的常量：`CHECK_UPDATE`, `START_DOWNLOAD`, `INSTALL_UPDATE`, `UPDATE_STATUS_CHANGED`。
- 删除未使用的类型引入：`CheckUpdateResponse`, `UpdateStatusPayload`。
- 删除未使用的图标引入：`RefreshCw`, `Download`, `ArrowUpCircle`, `AlertCircle`, `CheckCircle`（需保留 `Pencil`、`Plus`、`Star`、`Trash2`、`Key`、`Check` 供模型与 Tavily 使用）。
- 确认是否已无任何自定义事件绑定需求，若有则保留 `useEventBus`，若无则移除。

---

## Slice 4: 编译与验证

### 4.1 自动校验 (Linters & TS)
```bash
# 检查样式与规范性
pnpm lint
# 验证代码类型无缺失/冲突
pnpm format:check
```

### 4.2 手动测试步骤
1. 运行 `pnpm dev` 启动 Electron 应用。
2. 进入系统设置页面，确认侧边栏第三项展示“关于”，图标为 info。
3. 点击“关于”跳转至关于页面：
   - 确认可以看到 “Willow” 应用名称与 “v0.0.1” (或其他从底层读取的) 当前版本。
   - 确认系统更新模块正确加载，且静默检查无误（如果已经是最新版，界面应展示“当前已是最新版本”）。
4. 在关于页面中手动点击“检查更新”，确认检查动作成功触发。
5. 返回“配置”页面，确认“系统更新”相关的面板与按钮均已消失，且配置模型或 Tavily key 的功能仍保持完全正常，控制台无报错信息。

---

## 文件变更清单

| 动作 | 文件路径 |
| :--- | :--- |
| 修改 | `app/work/src/renderer/src/pages/setting/Setting.vue` |
| 修改 | `app/work/src/renderer/src/router.ts` |
| 新建 | `app/work/src/renderer/src/pages/setting/about/AboutSetting.vue` |
| 修改 | `app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue` |
