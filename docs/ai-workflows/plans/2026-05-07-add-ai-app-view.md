# Plan: AI 应用视图

**日期**: 2026-05-07
**变更**: `add-ai-app-view`
**OpenSpec**: `docs/ai-workflows/openspec/changes/add-ai-app-view/`

---

## 执行切片

### 切片 1: 主进程基础设施

**文件变更**:

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `app/work/src/main/main.ts` | 在 `CoreFactory.create()` 之前添加 `protocol.registerSchemesAsPrivileged` |
| 新建 | `app/work/src/main/service/ai-app-view.service.ts` | `AiAppViewService` — WebContentsView 生命周期 + 协议处理 |
| 新建 | `app/work/src/main/controllers/ai-app-view.controller.ts` | `AiAppViewController` — 3 个 IPC 通道 |
| 修改 | `app/work/src/shared/constants.ts` | 添加 `AI_APP_LOAD`、`AI_APP_BOUNDS`、`AI_APP_CLOSE` 常量 |
| 修改 | `app/work/src/shared/api.ts` | 添加 `AiAppLoadRequest`、`AiAppBoundsRequest` 类型 |
| 修改 | `app/work/src/main/app.module.ts` | 注册 `AiAppViewService` 和 `AiAppViewController` |

**步骤**:

1. **main.ts — 协议注册**
   - 在 `import { app } from "electron"` 之后添加 `import { protocol } from "electron"`
   - 在 `bootstrap()` 函数定义之前（顶层，`app.ready` 之前）调用：
     ```ts
     protocol.registerSchemesAsPrivileged([
       { scheme: "ai-app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
     ]);
     ```

2. **shared/constants.ts — IPC 通道常量**
   - 添加三个常量：`AI_APP_LOAD`、`AI_APP_BOUNDS`、`AI_APP_CLOSE`

3. **shared/api.ts — 请求/响应类型**
   - 添加 `AiAppLoadRequest { workspaceRoot: string }`
   - 添加 `AiAppBoundsRequest { x: number; y: number; width: number; height: number }`

4. **ai-app-view.service.ts — 核心 Service**
   - `@Injectable()` 类，实现 `OnDestroy`
   - 字段：`private view: WebContentsView | null`, `private workspaceRoot: string | null`
   - 构造函数中调用 `protocol.registerFileProtocol("ai-app", handler)`
   - `handleRequest`: 剥离 `ai-app://` 前缀 → decodeURIComponent → path.join(workspaceRoot, decoded) → callback({ path })
   - `createOrReuseView(mainWindow)`: 创建 `WebContentsView({ webPreferences: { webSecurity: true, contextIsolation: true } })` → `mainWindow.contentView.addChildView(view)`
   - `loadWorkspaceApp(workspaceRoot, mainWindow)`: 设置 root → 创建 view → `view.webContents.loadURL("ai-app://index.html")`
   - `setBounds(bounds)`: 直接调 `this.view?.setBounds(bounds)`
   - `destroyView()`: 从 contentView 移除 → close webContents → 置 null
   - `onDestroy()`: 调用 `destroyView()`

5. **ai-app-view.controller.ts — IPC Controller**
   - `@Injectable()` 类，继承 `IPCBaseController`
   - 构造函数注入 `AiAppViewService`
   - 三个 `@IPC(CHANNEL)` 方法：
     - `load`: 调用 `aiAppViewService.loadWorkspaceApp(request.workspaceRoot, mainWindow)`
     - `bounds`: 调用 `aiAppViewService.setBounds(request)`
     - `close`: 调用 `aiAppViewService.destroyView()`
   - 获取 `mainWindow`: `BrowserWindow.getAllWindows()[0]`

6. **app.module.ts — 注册**
   - `providers` 数组添加 `AiAppViewService`
   - `controllers` 数组添加 `AiAppViewController`
   - 构造函数注入 `AiAppViewController`（保持 DI 激活）

**验证**:
```bash
cd app/work && npx tsgo --noEmit  # 类型检查通过
```

---

### 切片 2: Preload + 类型桥接

**文件变更**:

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `app/work/src/shared/hook/index.ts` | 添加 `IAiAppApi` 到 `IRenderHook` |
| 新建 | `app/work/src/shared/hook/ai-app.hook.ts` | `IAiAppApi` 接口定义 |
| 修改 | `app/work/src/preload/preload.ts` | 添加 `aiApp` 命名空间方法 |

**步骤**:

1. **shared/hook/ai-app.hook.ts — API 类型接口**
   ```ts
   export interface IAiAppApi {
     loadAiApp(request: AiAppLoadRequest): Promise<void>;
     updateAiAppBounds(request: AiAppBoundsRequest): Promise<void>;
     closeAiApp(): Promise<void>;
   }
   ```

2. **shared/hook/index.ts — 注册到 IRenderHook**
   - `IRenderHook` 添加 `extends IAiAppApi`

3. **preload/preload.ts — 预加载方法**
   - 在 `ipcObject` 中添加 `aiApp` 命名空间（或直接添加三个顶层方法），每个方法：
     - `ipcRenderer.invoke(CHANNEL, request)`
     - 检查 `response.code !== 0`，抛出错误
     - 返回 `response.data`

**验证**:
```bash
cd app/work && npx tsgo --noEmit  # 类型检查通过，preload 无类型错误
```

---

### 切片 3: 渲染进程集成

**文件变更**:

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue` | app 标签页替换为 DOM 锚点 + ResizeObserver + IPC 调用 |

**步骤**:

1. **替换 app 标签页内容（template 部分）**
   - 将 `<ScrollArea v-else-if="activeTab === 'app'">` 内的占位 div 替换为：
     ```vue
     <div ref="viewAnchor" class="ai-app-anchor h-full w-full" />
     ```
   - 保留 `ScrollArea` 包裹（或直接用 div，因为 WebContentsView 会覆盖在上面，ScrollArea 无意义）

   **重要**: WebContentsView 是原生视图，会覆盖在渲染进程之上。`ScrollArea` 的滚动对原生视图无效。因此 `app` 标签页内容区域应该是一个简单的 `div`（不用 `ScrollArea`），让 WebContentsView 完全填充。

2. **添加 script 逻辑**
   - 导入 `ref`, `onMounted`, `onUnmounted`, `watch` from `vue`
   - 定义 `viewAnchor = ref<HTMLElement | null>(null)`
   - `let resizeObserver: ResizeObserver | null = null`
   - `onMounted` 中：
     - 等待 `viewAnchor.value` 可用
     - 创建 `ResizeObserver`，回调中：
       - 获取 `viewAnchor.value.getBoundingClientRect()`
       - 调用 `electronAPI.updateAiAppBounds({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) })`
     - `resizeObserver.observe(viewAnchor.value)`
   - `onUnmounted` 中：`resizeObserver?.disconnect()`，调用 `electronAPI.closeAiApp()`

3. **加载/卸载时机**
   - `watch(activeTab, (newTab, oldTab)`:
     - 当 `newTab === 'app'` 且 `workspacePath.value` 非空时：`electronAPI.loadAiApp({ workspaceRoot: workspacePath.value })`
     - 当 `oldTab === 'app'` 时：`electronAPI.closeAiApp()`
   - `workspacePath` 已在组件中通过 `useWorkspaceSettings` 获取

4. **空状态处理**
   - 使用一个 `showEmptyState = ref(false)` 标志
   - 在 `loadAiApp` 调用后设置一个短暂延迟（如 500ms），如果 WebContentsView 加载失败（可通过 `did-fail-load` 事件通知），显示空状态
   - 简化方案：在锚点 div 下方放一个 `v-if="showEmptyState"` 的提示文本，默认隐藏。后续可通过 IPC 事件通知加载失败

   **实际操作**: 由于 WebContentsView 加载失败是在主进程感知的，渲染进程难以直接获取。最简单的方式是：在锚点 div 后用 `v-if` 放一个后备提示，锚点始终存在。如果用户看不到内容（WebContentsView 透明/白色），提示文字会显示。但这样布局有问题。

   **更实际的方案**: 在 `AiAppViewService.loadWorkspaceApp` 中监听 `did-fail-load` 事件，加载失败时加载一个内联的 error HTML 页面，显示 "未找到 index.html"。

5. **主进程错误页面（补充 ai-app-view.service.ts）**
   - 在 `loadWorkspaceApp` 中，监听 `view.webContents.on('did-fail-load', ...)` 一次性事件
   - 失败时加载内联 data URL：`data:text/html,<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:%23999"><p>当前工作空间根目录未找到 index.html 文件</p></body></html>`

**验证**:
- `pnpm lint` 通过
- `pnpm build` 通过
- 手动测试：在工作空间根目录放置 `index.html`，打开 app 标签页，验证页面加载
- 手动测试：拖拽侧边栏宽度，验证 WebContentsView 同步缩放
- 手动测试：无 `index.html` 时显示错误页面

---

## 依赖关系

```
切片 1 (主进程基础设施)
    ↓
切片 2 (Preload + 类型桥接)
    ↓
切片 3 (渲染进程集成)
```

切片 1 和切片 2 可部分并行（shared/api.ts 和 shared/hook/ 类型定义不依赖 service 实现），但建议顺序执行以减少返工。

## 风险点

| 风险 | 缓解 |
|------|------|
| WebContentsView 覆盖在 ScrollArea 上导致滚动失效 | app 标签页不用 ScrollArea，用普通 div |
| `registerFileProtocol` 已被废弃（Electron 新版本） | 检查当前 Electron 版本；若 `protocol.handle` 可用则使用新 API |
| ResizeObserver 高频触发导致 IPC 风暴 | `Math.round` 已做基本的去重（相同值不触发 setBounds）；如需进一步节流，加 16ms requestAnimationFrame |
| WebContentsView 在 Windows/Linux 上的坐标偏移 | macOS `hiddenInset` 标题栏可能影响坐标；`getBoundingClientRect` 返回的是内容区域坐标，需验证 |

## 不做的事情

- 不添加 AI 应用编辑/热更新
- 不处理 AI 应用内部路由
- 不支持多窗口 AI 应用
- 不在渲染进程预检测 `index.html` 文件存在性（由主进程错误页面处理）

---

## 下一步

运行 `/workflow-implement` 进入实现阶段。
