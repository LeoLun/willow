# 关于页面与更新迁移规范

## 需求

### R1: 设置菜单与路由注册

1. **设置侧边栏菜单**：
   - 必须在 `Setting.vue` 的 `navItems` 中，在「配置」项之后增加「关于」菜单项：
     - `label`: "关于"
     - `icon`: `Info`（自 `lucide-vue-next` 引入）
     - `routeName`: "settingAbout"
     - `to`: "/setting/about"
2. **路由注册**：
   - 必须在 `router.ts` 中注册 `settingAbout` 子路由：
     - `path`: "about"
     - `name`: "settingAbout"
     - `component`: `AboutSetting` (对应 `/src/pages/setting/about/AboutSetting.vue`)

### R2: 关于页面 UI 设计与基础信息展示

`AboutSetting.vue` 页面的设计风格必须符合 `DESIGN.md` 中“桌面工作台”的调性：
1. **主标题**：
   - 页面顶部必须包含主标题 `关于`，字体大小为 `text-2xl`，粗细为 `font-semibold`。
2. **应用基础信息 Section**：
   - 使用紧凑、和谐的布局展示 Willow 基础信息：
     - **应用图标**：可以使用应用专属 SVG 或通过特定样式渲染的图标。
     - **应用名称**：显示大号加粗的 `Willow`。
     - **当前版本**：显示当前已安装的版本号（从主进程中读取或默认为 `v0.0.1`），外加 `Badge` 样式修饰。
     - **应用简介**：一行简明说明，如“轻量级桌面智能工作台”。
3. **样式与间距**：
   - 遵循 `DESIGN.md` 的间距控制，使用 `space-y-8` 组织大区域，用 `space-y-3` 组织 Section，在卡片或布局内采用简洁的边框 `border` 与细致的文本层次关系。

### R3: 关于页面 系统更新功能移植

必须将 `ConfigurationSetting.vue` 中的系统更新逻辑和 UI 结构百分之百迁移到 `AboutSetting.vue`：
1. **自动更新生命周期管理**：
   - 组件挂载时 (`onMounted`)，添加 `UPDATE_STATUS_CHANGED` 的事件监听，并执行一次静默更新检查 `handleCheckUpdate(true)`。
   - 组件卸载时 (`onUnmounted`)，注销 `UPDATE_STATUS_CHANGED` 的事件监听。
2. **状态变量**：
   - 包括：`updateStatus`, `updateProgress`, `updateError`, `hasUpdate`, `currentVersion`, `latestVersion`, `updateType`, `releaseNotes`, `publishDate`。
3. **核心动作函数**：
   - `handleCheckUpdate(silent)`: 调用 `electronAPI.checkUpdate()` 并更新状态。
   - `handleStartDownload()`: 调用 `electronAPI.startDownload()` 开始更新。
   - `handleInstallUpdate()`: 调用 `electronAPI.installUpdate()` 重启并更新/打开 DMG 安装。
4. **UI 表达**：
   - 检查更新按钮：在 `idle`、`error`、`available` 状态下显示，点击触发 `handleCheckUpdate(false)`；在 `checking` 状态下显示旋转动画并禁用按钮。
   - 更新类型 Badge：展示“增量热更新 (重启即用)”或“大版本整包更新 (DMG 拖拽覆盖)”。
   - 进度条：在 `downloading` 状态下展示 `Progress` 组件，百分比指示。
   - 错误面板：当有 `updateError` 时展示带 `AlertCircle` 的破坏性提示框。
   - 更新日志：当发现新版本且 `releaseNotes` 不为空时，渲染更新日志面板。

### R4: 配置页面清理

必须完全移除 `ConfigurationSetting.vue` 中的系统更新功能残留：
1. **UI 部分**：删除模板中最后的 `<section class="space-y-3">` 块（即“系统更新”的所有 HTML 元素）。
2. **逻辑部分**：
   - 删除更新检查与事件监听相关的 state、生命周期钩子（如果 `ConfigurationSetting.vue` 中没有其他事件监听，可移除 `useEventBus`）、生命周期里的逻辑。
   - 删除 `handleCheckUpdate`, `handleStartDownload`, `handleInstallUpdate` 函数。
3. **导入部分**：
   - 清理未使用的 icon 导入（如 `RefreshCw`、`Download`、`ArrowUpCircle`、`AlertCircle`、`CheckCircle`）。
   - 清理未使用的 IPC 常量导入（如 `CHECK_UPDATE`、`START_DOWNLOAD`、`INSTALL_UPDATE`、`UPDATE_STATUS_CHANGED`）。
   - 清理未使用的 API 类型引入（如 `CheckUpdateResponse`、`UpdateStatusPayload`）。

## 验收标准

- [ ] 设置侧边栏成功出现「关于」菜单项，点击后能够跳转至 `/setting/about` 并渲染关于页面。
- [ ] 关于页面中正常显示 Willow 名称、图标、当前版本以及系统更新状态卡片。
- [ ] 进入关于页面时能够静默触发版本更新检查，并将获取到的当前版本显示在“当前版本”标签中。
- [ ] 点击关于页面的“检查更新”按钮后能正确向主进程发送请求，并在有更新时展示新版本号、更新类型、更新日志和“下载/立即更新”按钮。
- [ ] 点击“下载更新”或“立即更新”时，能够展示下载进度条。
- [ ] 配置页面（`ConfigurationSetting.vue`）中不再包含任何有关系统更新的 UI 元素，代码中无残留的更新状态监听及未使用的 imports，控制台无报错。
