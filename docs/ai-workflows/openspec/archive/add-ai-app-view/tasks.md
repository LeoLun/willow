# Tasks: AI 应用视图

## 1. 主进程 — 自定义协议注册

- [x] 1.1 在 `main.ts` 中，`CoreFactory.create()` 之前调用 `protocol.registerSchemesAsPrivileged` 注册 `ai-app` scheme（standard, secure, supportFetchAPI）

## 2. 主进程 — AiAppViewService

- [x] 2.1 新建 `app/work/src/main/service/ai-app-view.service.ts`
- [x] 2.2 实现 `protocol.handle` 处理器：解析 `ai-app://` URL，映射到 `this.workspaceRoot` 对应文件路径
- [x] 2.3 实现 `createOrReuseView(mainWindow)`: 创建 `WebContentsView`（webSecurity: true, contextIsolation: true），挂载到 `mainWindow.contentView`
- [x] 2.4 实现 `loadWorkspaceApp(workspaceRoot, mainWindow)`: 更新根目录，加载 `ai-app://index.html`
- [x] 2.5 实现 `setBounds(bounds)`: 更新 WebContentsView 的位置和大小
- [x] 2.6 实现 `hideView()` 与销毁清理：标签失活时隐藏 WebContentsView，服务销毁时从 contentView 移除并关闭
- [x] 2.7 实现 `OnDestroy` 生命周期钩子，确保视图被清理

## 3. 主进程 — AiAppViewController

- [x] 3.1 新建 `app/work/src/main/controllers/ai-app-view.controller.ts`
- [x] 3.2 定义 IPC 通道：`ai-app:load`（加载应用）、`ai-app:bounds`（更新 bounds）、`ai-app:close`（关闭视图）
- [x] 3.3 注入 `AiAppViewService`，实现各 IPC 处理方法

## 4. 主进程 — 模块注册

- [x] 4.1 在 `AppModule` 的 `providers` 中添加 `AiAppViewService`
- [x] 4.2 在 `AppModule` 的 `controllers` 中添加 `AiAppViewController`

## 5. 渲染进程 — IPC 通道

- [x] 5.1 在 `app/work/src/renderer/src/lib/ipc.ts` 或共享类型文件中添加 `ai-app` 相关 IPC 方法类型定义

## 6. 渲染进程 — ChatRightSidebar 改造

- [x] 6.1 在 `ChatRightSidebar.vue` 的 `app` 标签页中替换占位文本，放置 DOM 锚点 `<div ref="viewAnchor">`
- [x] 6.2 实现 `ResizeObserver` 监听锚点大小/位置变化，通过 IPC 发送 `ai-app:bounds`
- [x] 6.3 在 `app` 标签页激活时（watch activeTab === 'app'），获取 `workspaceRoot`，调用 `ai-app:load`
- [x] 6.4 在 `app` 标签页失活或组件卸载时，调用 `ai-app:close`
- [x] 6.5 处理 `index.html` 不存在的空状态：占位提示 "工作空间根目录未找到 index.html"

## 7. 渲染进程 — 聊天页自适应布局

- [x] 7.1 在 `Chat.vue` 中为中间对话区域定义并应用最小宽度，建议使用集中常量（例如 `CHAT_MAIN_MIN_WIDTH = 350`）
- [x] 7.2 调整右侧栏有效宽度计算：保留用户拖拽偏好值，同时按当前可用空间、中间对话区最小宽度和右侧栏最小宽度钳位，不设置固定最大宽度
- [x] 7.3 左侧主导航关闭时，中间对话区域保持稳定宽度，释放出的水平空间优先分配给右侧栏
- [x] 7.4 左侧主导航重新打开或窗口变窄时，右侧栏优先收缩，不挤压中间对话区域低于最小宽度
- [x] 7.5 确保右侧栏实际宽度变化后，`ChatRightSidebar` 的应用 DOM 锚点触发 `ai-app:bounds` 同步

## 8. 验证

- [x] 8.1 `pnpm lint` 通过
- [x] 8.2 `pnpm build` 通过
- [x] 8.3 手动测试：在工作空间根目录放置 `index.html`，打开 app 标签页，验证页面正常加载
- [x] 8.4 手动测试：验证拖拽侧边栏宽度变化时 WebContentsView 同步缩放
- [x] 8.5 手动测试：验证切换工作空间时视图正确更新
- [x] 8.6 手动测试：验证 `index.html` 不存在时的空状态提示
- [x] 8.7 手动测试：缩小窗口时，中间对话区域不低于最小宽度，输入器和消息内容不被压垮
- [x] 8.8 手动测试：关闭左侧主导航时，中间对话区宽度保持稳定，右侧应用区域自适应变宽
- [x] 8.9 手动测试：左侧主导航开关、窗口 resize、拖拽右侧栏后，WebContentsView 与右侧应用区域保持对齐
