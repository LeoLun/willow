# Design: AI 应用视图

## 架构全景

```
┌──────────────────────────────────────────────────────────┐
│ Main Process                                             │
│                                                          │
│  main.ts                                                 │
│    protocol.registerSchemesAsPrivileged([...]) ─┐        │
│    CoreFactory.create(AppModule)                 │        │
│                                                  │        │
│  AppModule                                       │        │
│    providers: [..., AiAppViewService]            │        │
│    controllers: [..., AiAppViewController]       │        │
│                                                  │        │
│  AiAppViewService                          ┌─────┘        │
│    - protocol.handle("ai-app")               │              │
│    - createWebContentsView()                │              │
│    - setBounds(bounds)                      │              │
│    - loadWorkspaceApp(workspaceRoot)        │              │
│    - hideView() / onDestroy cleanup          │              │
│                                                  │         │
│  AiAppViewController (IPC)                       │         │
│    - on "ai-app:load" → service.loadWorkspaceApp │         │
│    - on "ai-app:bounds" → service.setBounds      │         │
│    - on "ai-app:close" → service.hideView        │         │
│                                                  │         │
│  ┌──────────────────────────────────────┐        │         │
│  │     BrowserWindow (MainWindow)       │        │         │
│  │  ┌────────────────────────────────┐  │        │         │
│  │  │  contentView                    │  │        │         │
│  │  │  ┌──────────┐ ┌──────────────┐ │  │        │         │
│  │  │  │ renderer │ │WebContentsView│ │  │        │         │
│  │  │  │  (Vue)   │ │ (ai-app://)  │ │  │        │         │
│  │  │  │          │ │              │ │  │        │         │
│  │  │  └──────────┘ └──────────────┘ │  │        │         │
│  │  └────────────────────────────────┘  │        │         │
│  └──────────────────────────────────────┘        │         │
└──────────────────────────────────────────────────────────┘
                                                          │
┌──────────────────────────────────────────────────────────┐
│ Renderer Process                                         │
│                                                          │
│  Chat.vue                                                │
│    <ChatRightSidebar>                                    │
│                                                          │
│  ChatRightSidebar.vue                                    │
│    app 标签页:                                           │
│      <div ref="viewAnchor">  ← ResizeObserver           │
│        发送 bounds 到主进程 (IPC)                        │
│                                                          │
│  使用 useWorkspaceSettings 获取 workspaceRoot             │
│  调用 ipc.aiApp.load(workspaceRoot)                     │
└──────────────────────────────────────────────────────────┘
```

## 组件设计

### 0. 聊天页自适应布局

聊天页继续由 `Chat.vue` 作为布局状态 owner。右侧栏宽度仍由父组件管理并通过 props 传给 `ChatRightSidebar.vue`，但宽度计算需要从“固定拖拽值”升级为“用户偏好宽度 + 当前可用空间约束”。

布局优先级：

1. 中间对话区域是主工作区，必须保留最小宽度。
2. 左侧主导航打开或关闭时，中间对话区域应保持同一稳定宽度，避免消息内容、输入器和标题区横向跳动。
3. 右侧应用区域是辅助工作区，应吸收左侧主导航关闭后释放的水平空间。
4. 当窗口宽度不足时，优先保证中间对话区域最小宽度，再压缩右侧区域到最小宽度；仍不足时允许页面整体保持受控溢出或关闭/隐藏右侧栏，具体实现按现有桌面壳能力选择。

建议在 `Chat.vue` 中定义清晰的布局常量：

```ts
const CHAT_MAIN_MIN_WIDTH = 350;
const RIGHT_SIDEBAR_MIN_WIDTH = 240;
const RIGHT_SIDEBAR_DEFAULT_WIDTH = 320;
```

右侧栏有效宽度计算应遵守：

- 用户拖拽值仍作为偏好值持久化到 `sidebar-width`。
- 实际渲染宽度需要被当前可用空间和中间对话区域最小宽度钳位。
- 右侧栏不设置固定最大宽度；上限由 `calc(100% - CHAT_MAIN_MIN_WIDTH - resizeHandleWidth)` 决定。
- 当左侧主导航关闭导致可用空间增加时，通过 CSS 变量同步把释放空间加入右侧栏实际宽度，中间对话区域保持关闭前宽度。
- 当左侧主导航重新打开导致可用空间减少时，右侧栏优先收缩；中间对话区域不应低于 `CHAT_MAIN_MIN_WIDTH`。
- 左侧主导航状态到右侧栏宽度的联动应使用 CSS 状态选择器和 CSS 变量表达，避免 JS 监听左侧导航状态或等待布局测量后再更新。

这项布局规则只属于聊天页壳层，不下沉到 `ChatRightSidebar.vue` 内部。`ChatRightSidebar.vue` 仍只负责按收到的 `width` 渲染右侧内容和同步应用锚点 bounds。

### 1. 自定义协议注册（main.ts）

在 `CoreFactory.create(AppModule)` 之前调用：

```ts
protocol.registerSchemesAsPrivileged([
  { scheme: "ai-app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
```

`supportFetchAPI: true` 确保 `ai-app://` 协议下的页面可以使用 `fetch` 进行同源请求。

### 2. AiAppViewService（新增 Service）

职责：管理 `WebContentsView` 的完整生命周期和协议处理。

```ts
@Injectable()
export class AiAppViewService implements OnDestroy {
  private view: WebContentsView | null = null;
  private workspaceRoot: string | null = null;

  // 在 app ready 后注册协议处理器
  constructor() {
    protocol.handle("ai-app", this.handleRequest.bind(this));
  }

  // 协议请求处理
  private handleRequest(request: Request, callback: (response: ProtocolResponse) => void): void {
    if (!this.workspaceRoot) {
      callback({ error: -2 }); // net::ERR_FAILED
      return;
    }
    const url = request.url.replace("ai-app://", "");
    const decodedPath = decodeURIComponent(url);
    const filePath = path.join(this.workspaceRoot, decodedPath);
    callback({ path: filePath });
  }

  // 创建或复用 WebContentsView
  createOrReuseView(mainWindow: BrowserWindow): WebContentsView {
    if (this.view) return this.view;
    this.view = new WebContentsView({
      webPreferences: {
        webSecurity: true,
        contextIsolation: true,
      },
    });
    mainWindow.contentView.addChildView(this.view);
    return this.view;
  }

  // 加载工作空间 AI 应用
  loadWorkspaceApp(workspaceRoot: string, mainWindow: BrowserWindow): void {
    this.workspaceRoot = workspaceRoot;
    const view = this.createOrReuseView(mainWindow);
    view.webContents.loadURL("ai-app://index.html");
  }

  // 更新 bounds（由 IPC 触发）
  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    if (this.view) this.view.setBounds(bounds);
  }

  // 隐藏视图
  hideView(): void {
    if (this.view) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.contentView.removeChildView(this.view);
      this.view.webContents.close();
      this.view = null;
    }
  }

  onDestroy(): void {
    this.hideView();
  }
}
```

### 3. AiAppViewController（新增 Controller）

IPC 通道定义：

| 通道名 | 方向 | 参数 | 返回值 |
|--------|------|------|--------|
| `ai-app:load` | renderer → main | `{ workspaceRoot: string }` | `void` |
| `ai-app:bounds` | renderer → main | `{ x, y, width, height }` | `void` |
| `ai-app:close` | renderer → main | `void` | `void` |

使用 `@IpcHandle` 装饰器（或项目现有的 IPC 装饰器模式）。

### 4. 渲染进程 DOM 绑定（ChatRightSidebar.vue）

在 `app` 标签页中放置锚点元素：

```vue
<template v-if="activeTab === 'app'">
  <div ref="viewAnchor" class="ai-app-anchor" />
</template>
```

使用 `ResizeObserver` 监听锚点的大小和位置变化：

```ts
const viewAnchor = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!viewAnchor.value) return;
  resizeObserver = new ResizeObserver(() => {
    if (!viewAnchor.value) return;
    const rect = viewAnchor.value.getBoundingClientRect();
    window.electronAPI.updateAiAppViewBounds({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  });
  resizeObserver.observe(viewAnchor.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
```

当右侧应用区域因左侧主导航关闭、窗口 resize、用户拖拽或标签页切换而改变尺寸时，`ResizeObserver` 必须继续发送最新 bounds。发送 bounds 时应使用右侧栏的实际渲染宽度，而不是仅使用用户持久化偏好值。

### 5. IPC 通道注册（shared/api.ts / 新增通道常量）

在 `app/work/src/shared/` 中新增 IPC 通道常量或在 `AiAppViewController` 中直接定义。

### 6. 模块注册（AppModule）

在 `@Module` 装饰器中添加：

```ts
providers: [..., AiAppViewService],
controllers: [..., AiAppViewController],
```

## 数据流

```
1. 用户打开 app 标签页
   → ChatRightSidebar activeTab = 'app'
   → onMounted: 获取 workspaceRoot
   → ipc.invoke("ai-app:load", { workspaceRoot })
   → AiAppViewController.load()
   → AiAppViewService.loadWorkspaceApp(root, mainWindow)
     → 更新 this.workspaceRoot
     → 创建 WebContentsView，挂载到 contentView
     → loadURL("ai-app://index.html")
     → 协议处理器解析路径，返回文件

2. DOM 锚点大小/位置变化
   → ResizeObserver 回调
   → ipc.invoke("ai-app:bounds", { x, y, w, h })
   → AiAppViewController.updateBounds()
   → AiAppViewService.setBounds(bounds)
   → view.setBounds(bounds)

3. 切换工作空间 / 关闭标签页
   → ipc.invoke("ai-app:close")
   → AiAppViewController.close()
   → AiAppViewService.hideView()
   → 隐藏 WebContentsView；主窗口销毁时再清理原生视图
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 工作空间无 `index.html` | WebContentsView 加载失败 → 显示 error 页面（内联 HTML） |
| `workspaceRoot` 为空/无效 | 协议处理器返回 `net::ERR_FAILED`，不创建视图 |
| `WebContentsView` 创建失败 | try/catch，渲染进程显示 toast 提示 |
| 主窗口已销毁 | `BrowserWindow.getAllWindows()[0]` 返回 `undefined`，安全跳过 |
| 快速切换标签页 | `loadURL` 会取消前一次加载，Electron 自动处理 |

## 与现有系统的交互

- **ChatRightSidebar**: `app` 标签页是此功能的唯一展示区域，替换现有占位文本
- **Chat.vue**: 继续作为右侧栏 open 状态、拖拽宽度、有效宽度和中间对话区最小宽度的 owner
- **useWorkspaceSettings**: 复用现有 composable 获取 `workspaceRoot`
- **MainWindow**: 通过 `BrowserWindow.getAllWindows()[0]` 获取窗口实例用于挂载 WebContentsView
- **ipc 桥接**: 复用 `app/work/src/renderer/src/lib/ipc.ts` 的类型安全 IPC 模式

## 安全考量

- `contextIsolation: true` — AI 应用无法直接访问 Node.js API
- `webSecurity: true` — 保持浏览器安全策略
- 无 `nodeIntegration` — 不暴露 Node.js 给加载的页面
- 协议仅限于工作空间根目录下的文件，无法逃逸到系统文件
