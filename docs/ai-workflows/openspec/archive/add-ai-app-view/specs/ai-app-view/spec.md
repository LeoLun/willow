# Spec: AI 应用视图

## 功能概述

在聊天页面右侧边栏的 "应用" 标签页中，通过 Electron `WebContentsView` + 自定义 `ai-app://` 协议加载并展示当前工作空间根目录下的 `index.html` 文件。

## 协议规范

### `ai-app` 自定义协议

- **scheme**: `ai-app`
- **privileges**:
  - `standard: true` — 作为标准协议（与 http/https 同级）
  - `secure: true` — 视为安全协议
  - `supportFetchAPI: true` — 支持 `fetch` API
- **注册时机**: `app.ready` 之前（`main.ts` 中 `CoreFactory.create()` 之前）
- **URL 格式**: `ai-app://<relative-path>`
- **路径映射**: `<workspaceRoot>/<relative-path>`（`decodeURIComponent` 解码）
- **默认入口**: `ai-app://index.html`

### 协议处理规则

- 如果 `workspaceRoot` 为空或未设置 → 返回 `net::ERR_FAILED`（error: -2）
- 文件存在 → 返回文件内容
- 文件不存在 → Electron 自动返回 `net::ERR_FILE_NOT_FOUND`

## WebContentsView 规范

### 创建参数

```ts
new WebContentsView({
  webPreferences: {
    webSecurity: true,
    contextIsolation: true,
  },
});
```

### 挂载

- 挂载到 `MainWindow` 的 `BrowserWindow.contentView`
- 作为 `childView` 添加（`contentView.addChildView(view)`）

### Bounds 同步

- `setBounds({ x, y, width, height })` 由主进程在收到 IPC `ai-app:bounds` 时调用
- 坐标基于窗口内容区域（视口坐标），与 `getBoundingClientRect()` 一致

### 生命周期

| 事件 | 行为 |
|------|------|
| app 标签页激活 | 创建 WebContentsView（如不存在），加载 `ai-app://index.html` |
| app 标签页失活 | 销毁 WebContentsView，从 contentView 移除 |
| 组件卸载 | 销毁 WebContentsView |
| 主窗口关闭 | `OnDestroy` 钩子自动清理 |
| 工作空间切换 | 更新 `workspaceRoot`，重新加载 `ai-app://index.html` |

## IPC 通道规范

### `ai-app:load`

- **方向**: renderer → main
- **参数**: `{ workspaceRoot: string }`
- **行为**: 设置工作空间根目录，创建/复用 WebContentsView，加载 `ai-app://index.html`
- **错误处理**: `workspaceRoot` 为空时跳过，不创建视图

### `ai-app:bounds`

- **方向**: renderer → main
- **参数**: `{ x: number, y: number, width: number, height: number }`
- **行为**: 更新 WebContentsView 的位置和大小
- **频率**: 由 ResizeObserver 驱动（DOM 锚点大小/位置变化时触发）

### `ai-app:close`

- **方向**: renderer → main
- **参数**: 无
- **行为**: 从 contentView 移除并销毁 WebContentsView

## 聊天页自适应布局规范

### 中间对话区域最小宽度

- 聊天页中间对话区域 SHALL 设置明确的最小宽度。
- 推荐最小宽度为 `350px`，实现时可以用命名常量集中声明。
- 该最小宽度 SHALL 覆盖消息列表、空状态、标题区和输入器所在的主聊天列。

#### Scenario: Keep chat readable when right app is open

- **GIVEN** 用户打开聊天页右侧栏并切换到 `应用` 标签
- **WHEN** 窗口宽度减少或用户拖拽扩大右侧栏
- **THEN** 中间对话区域不会被压缩到最小宽度以下
- **AND** 输入器和消息内容仍保持可读、可操作

### 左侧主导航关闭时稳定中间对话区

- 左侧主导航打开/关闭时，中间对话区域 SHOULD 保持关闭前后的稳定宽度。
- 左侧主导航关闭释放出的水平空间 SHOULD 优先分配给右侧栏，尤其是 `应用` 标签页。
- 如果当前窗口宽度不足以同时满足中间对话区最小宽度与右侧栏偏好宽度，右侧栏 SHALL 优先收缩。

#### Scenario: Closing left sidebar expands right app instead of chat

- **GIVEN** 左侧主导航处于打开状态
- **AND** 聊天页右侧栏处于打开状态
- **AND** 右侧栏当前标签为 `应用`
- **WHEN** 用户关闭左侧主导航
- **THEN** 中间对话区域宽度保持稳定，不因释放空间明显变宽
- **AND** 右侧应用区域使用释放出的水平空间自适应变宽
- **AND** `WebContentsView` bounds 更新到新的右侧应用区域尺寸

### 右侧应用区域自适应宽度

- 右侧栏 SHALL 继续支持用户拖拽调整宽度并持久化偏好值。
- 右侧栏实际宽度 SHALL 基于当前窗口可用宽度、中间对话区最小宽度、右侧栏最小宽度和用户偏好宽度计算。
- 当可用空间增加时，右侧栏 MAY 超过用户偏好宽度以填充释放空间；右侧栏不设置固定最大宽度，上限由当前可用空间和中间对话区域最小宽度共同决定。
- 当可用空间减少时，右侧栏 SHALL 收缩到可用范围内，并不得导致中间对话区低于最小宽度。

#### Scenario: Resize keeps WebContentsView aligned

- **GIVEN** 右侧栏当前标签为 `应用`
- **WHEN** 左侧主导航开关、窗口 resize 或用户拖拽右侧分隔条导致右侧栏实际宽度变化
- **THEN** `ChatRightSidebar` 中的 DOM 锚点尺寸同步变化
- **AND** renderer 通过 `ai-app:bounds` 发送新的取整 bounds
- **AND** 主进程中的 `WebContentsView` 与右侧应用区域保持对齐

### 布局边界

- 自适应规则 SHALL 实现在聊天页壳层，不在 `ChatRightSidebar.vue` 内部重新管理拖拽状态。
- 左侧主导航关闭释放空间到右侧栏的联动 SHALL 使用 CSS 变量 / CSS 状态选择器同步表达，不依赖 JS 监听左侧导航状态或动态测量容器宽度。
- 本变更 SHALL NOT 引入全局三栏拖拽系统。
- 本变更 SHALL NOT 改变左侧主导航自身的折叠交互。

## 渲染进程规范

### DOM 锚点

- 位于 `ChatRightSidebar.vue` 的 `app` 标签页内容区域
- 元素: `<div ref="viewAnchor" class="ai-app-anchor" />`
- 样式: `width: 100%; height: 100%;`（填充标签页内容区域）

### ResizeObserver 绑定

- 监听的元素: `viewAnchor`
- 回调: 计算 `getBoundingClientRect()`，通过 IPC 发送 `ai-app:bounds`
- 坐标取整: `Math.round()`
- 生命周期: `onMounted` 时创建，`onUnmounted` 时销毁
- 当右侧栏实际宽度因自适应规则变化时，也必须触发 bounds 同步

### 加载时机

- `activeTab === 'app'` 时触发加载
- 使用 `useWorkspaceSettings` 获取当前工作空间的 `rootPath`
- 通过 IPC `ai-app:load` 发送请求

### 空状态

- 当 `workspaceRoot` 下不存在 `index.html` 时，WebContentsView 将显示加载错误
- 可选优化：在渲染进程检测文件存在性，未找到时显示提示文本 "当前工作空间根目录未找到 index.html 文件"

## 模块注册

### AppModule 变更

```ts
@Module({
  // ...
  providers: [
    // ...existing providers
    AiAppViewService,
  ],
  controllers: [
    // ...existing controllers
    AiAppViewController,
  ],
})
```

### main.ts 变更

```ts
// 在 CoreFactory.create(AppModule) 之前
protocol.registerSchemesAsPrivileged([
  { scheme: "ai-app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
```

## 安全约束

| 约束 | 实现方式 |
|------|----------|
| 无 Node.js 暴露 | `contextIsolation: true`，无 `nodeIntegration` |
| 同源策略 | `webSecurity: true`，所有资源通过 `ai-app://` 加载 |
| 路径逃逸防护 | 协议处理器仅拼接 `workspaceRoot + relativePath`，拒绝 `..` 逃逸（path.join 自动规范化） |
| 无 preload 脚本 | `WebContentsView` 不设置 `preload`，AI 应用无法访问 IPC |

## 本地开发注意

- `registerSchemesAsPrivileged` 必须在 `app.ready` 前调用，即 `main.ts` 顶层
- 自定义协议请求处理在 `app.ready` 后注册；当前实现可使用 Electron 新版 `protocol.handle` + `net.fetch`
- 开发模式下（Vite dev server），主窗口加载的是 `http://localhost:xxxx`，WebContentsView 仍使用 `ai-app://` 协议，两者独立
