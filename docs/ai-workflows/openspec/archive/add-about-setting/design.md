# 设计文档：关于页面与更新迁移

## 架构与设计决策

### 1. 路由与菜单配置

设置页面是一个嵌套路由布局，左侧为固定的 `navItems` 侧边栏，右侧使用 `<RouterView />` 渲染当前激活的子路由组件。

- **`Setting.vue` 侧边栏菜单**：
  在 `navItems` 数组中添加新的对象：
  ```typescript
  {
    label: "关于",
    icon: Info,
    routeName: "settingAbout",
    to: "/setting/about",
  }
  ```
- **`router.ts` 路由注册**：
  在 `/setting` 路由的 `children` 数组中追加：
  ```typescript
  {
    path: "about",
    name: "settingAbout",
    component: () => import("./pages/setting/about/AboutSetting.vue") // 或直接静态导入
  }
  ```

### 2. `AboutSetting.vue` UI 与组件设计

按照 `DESIGN.md` 中桌面工作台的冷静、专注风格，新页面包含两个 Section：

- **主标题**：
  ```html
  <h1 class="text-2xl font-semibold">关于</h1>
  ```

- **Section 1: 应用信息**：
  展示应用的基本品牌形象，使用细边框卡片：
  ```html
  <section class="space-y-3">
    <div class="space-y-1">
      <h2 class="text-base font-medium">应用信息</h2>
      <p class="text-sm text-muted-foreground">Willow 桌面应用基本信息</p>
    </div>
    <div class="flex items-center gap-4 rounded-lg border p-4">
      <!-- 极简设计 Logo，或使用 Lucide Sparkles/Workflow 图标以配合工作台主题 -->
      <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles class="size-6" />
      </div>
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-base font-semibold">Willow</span>
          <Badge variant="secondary" class="font-mono text-xs">{{ currentVersion || "v0.0.1" }}</Badge>
        </div>
        <p class="text-xs text-muted-foreground">轻量级桌面智能工作台</p>
      </div>
    </div>
  </section>
  ```

- **Section 2: 系统更新**：
  将 `ConfigurationSetting.vue` 中的系统更新模板（第 338-462 行）原封不动移至此处。

### 3. 数据流与事件流管理

- 系统更新模块与主进程通过 `electronAPI` 与 `useEventBus` 进行交互。
- 迁移时，状态维护和事件注册逻辑全部移至 `AboutSetting.vue`。
  - `onMounted` 时，通过 `addEventListener(UPDATE_STATUS_CHANGED, ...)` 绑定状态监听，并调用 `handleCheckUpdate(true)` 静默检查更新。这样进入“关于”页面即可自动加载当前版本（如果没检测到新版本，则展示当前版本，如 `v0.0.1`）。
  - `onUnmounted` 时，通过 `removeEventListener(UPDATE_STATUS_CHANGED, ...)` 释放资源。

### 4. 依赖分析与文件修改

- **新增文件**：
  - `app/work/src/renderer/src/pages/setting/about/AboutSetting.vue`
- **修改文件**：
  - `app/work/src/renderer/src/pages/setting/Setting.vue`
  - `app/work/src/renderer/src/router.ts`
  - `app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue`
