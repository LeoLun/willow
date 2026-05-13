# Plan: AI 应用视图自适应补齐

**日期**: 2026-05-09
**变更**: `add-ai-app-view`
**OpenSpec**: `docs/ai-workflows/openspec/archive/add-ai-app-view/`

## 计划依据

- `proposal.md`: 推荐 `WebContentsView + ai-app://`，并补充“中间对话区稳定锚点 + 右侧应用区吸收释放空间”。
- `design.md`: `Chat.vue` 继续作为右侧栏 open 状态、拖拽宽度、有效宽度和中间对话区最小宽度 owner。
- `specs/ai-app-view/spec.md`: 需要满足中间对话区最小宽度、关闭左侧主导航后右侧应用区自适应变宽、`WebContentsView` bounds 对齐。
- `tasks.md`: 当前新增重点是第 7 节“聊天页自适应布局”，同时校准已存在的 AI 应用视图实现。
- `DESIGN.md`: renderer 是桌面工作台，布局要稳定、紧凑、可扫；不引入新的视觉体系或多层外壳。

## 当前实现观察

- `app/work/src/main/service/ai-app-view.service.ts`、`AiAppViewController`、preload 和 shared hook 已存在，说明主进程与桥接已有初版实现。
- `ChatRightSidebar.vue` 已有 `viewAnchor`、`ResizeObserver`、`loadAiApp`、`updateAiAppBounds`、`closeAiApp` 调用。
- `Chat.vue` 已用 `useDragResize` 管理右侧栏拖拽偏好宽度，并将 `sidebarWidth` 传给 `ChatRightSidebar`。
- 左侧主导航状态来自 `@willow/shadcn/components/ui/sidebar` 的 `useSidebar()`，可在 `Chat.vue` 读取 `state/open`。
- 当前缺口集中在：中间对话区没有明确稳定宽度策略；左侧主导航关闭释放空间后不会优先给右侧应用区；右侧栏实际宽度与持久化偏好值还没有分层。

## 执行切片

### 切片 1: 校准 AI 应用视图已有实现

目标：先确认现有主进程、preload、IPC 和渲染锚点实现与 OpenSpec 对齐，避免后续布局调试被基础能力问题干扰。

涉及文件：

| 文件 | 操作 |
|------|------|
| `app/work/src/main/service/ai-app-view.service.ts` | 校准协议处理、错误页、调试行为和生命周期 |
| `app/work/src/main/controllers/ai-app-view.controller.ts` | 确认 IPC 通道参数和主窗口获取逻辑 |
| `app/work/src/preload/preload.ts` | 确认暴露的 `loadAiApp` / `updateAiAppBounds` / `closeAiApp` 与类型一致 |
| `app/work/src/shared/constants.ts` | 确认 `AI_APP_LOAD` / `AI_APP_BOUNDS` / `AI_APP_CLOSE` 常量 |
| `app/work/src/shared/hook/ai-app.hook.ts` | 确认 renderer API 类型 |

实施步骤：

1. 对照 OpenSpec 检查 `protocol.registerSchemesAsPrivileged` 是否在 `app.ready` 前执行。
2. 保留当前 `protocol.handle + net.fetch` 方案，只要它符合当前 Electron 版本；不要退回已废弃的 `registerFileProtocol`。
3. 检查 `ai-app://localhost/index.html` 的 URL 解析，确保最终映射到 `<workspaceRoot>/index.html`。
4. 移除或门控 `view.webContents.openDevTools()`，避免普通使用时自动打开开发者工具。
5. 确认加载失败时展示内联错误页：“当前工作空间根目录未找到 index.html 文件”。
6. 确认隐藏应用标签页时优先 `setVisible(false)`，组件销毁时再关闭 WebContentsView，避免频繁创建销毁导致闪烁。

验证：

- 类型检查不出现 AI app 相关类型错误。
- 打开 `应用` 标签时主进程不重复注册协议。
- 无 `index.html` 时展示错误页，而不是空白或崩溃。

### 切片 2: 在 `Chat.vue` 建立稳定布局 owner

目标：让中间对话区拥有明确最小宽度，并把“拖拽偏好宽度”和“实际渲染宽度”分开。

涉及文件：

| 文件 | 操作 |
|------|------|
| `app/work/src/renderer/src/pages/chat/Chat.vue` | 新增布局常量、容器 ref、左侧导航状态读取、有效右栏宽度计算 |
| `app/work/src/renderer/src/composables/useDragResize.ts` | 必要时只做小范围扩展，保留现有拖拽语义 |

实施步骤：

1. 在 `Chat.vue` 使用 `useSidebar()` 读取左侧主导航 `state` 或 `open`。
2. 定义集中常量：
   - `CHAT_MAIN_MIN_WIDTH = 350`
   - `RIGHT_SIDEBAR_MIN_WIDTH = 240`
   - `RIGHT_SIDEBAR_DEFAULT_WIDTH = 320`
   - 右侧栏不设置固定最大宽度，上限由会话栏最小宽度决定
   - 左侧主导航展开与收起宽度差值需要从现有 sidebar token 或实测 DOM 宽度推导，不硬编码到多个位置。
3. 为聊天页水平布局外层添加 `ref`，通过 `ResizeObserver` 或窗口 resize 记录当前可用宽度。
4. 将 `useDragResize` 返回的 `width` 视为用户偏好宽度，新增 `effectiveSidebarWidth` 作为传给 `ChatRightSidebar` 的实际渲染宽度。
5. 中间主聊天列应用 `min-width: CHAT_MAIN_MIN_WIDTHpx`，并保留 `min-w-0` 来避免内部长内容撑破布局。
6. 拖拽分隔条继续使用当前交互：mousedown、mousemove、mouseup、双击重置、拖拽中禁用 transition。

验证：

- 右侧栏关闭时聊天页仍可正常铺满。
- 右侧栏打开时，中间对话区不低于 `350px`。
- 拖拽宽度仍会持久化到 `sidebar-width`。

### 切片 3: 实现左侧主导航关闭时右侧应用区吸收空间

目标：满足截图反馈：关闭左侧主导航后，中间对话区不明显变宽，释放空间优先进入右侧应用区域。

涉及文件：

| 文件 | 操作 |
|------|------|
| `app/work/src/renderer/src/pages/chat/Chat.vue` | 实现左侧导航状态变化下的有效宽度公式 |
| `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue` | 保持只接收 `width`，不下沉布局状态 |

实施步骤：

1. 在左侧主导航处于展开状态时，记录或计算中间聊天区的基准宽度。
2. 当左侧主导航从展开变为收起时，将释放的水平空间加入 `effectiveSidebarWidth`，而不是交给中间聊天列自然扩张。
3. 当左侧主导航从收起恢复展开时，右侧栏优先收缩回用户偏好宽度或当前可用宽度内的最大合法值。
4. 有效右侧栏宽度按以下优先级钳位：
   - 不小于 `RIGHT_SIDEBAR_MIN_WIDTH`
   - 不设置固定最大宽度；只受当前可用空间与中间对话区最小宽度限制
   - 不让中间对话区低于 `CHAT_MAIN_MIN_WIDTH`
5. 当窗口太窄，无法同时容纳中间最小宽度和右侧最小宽度时，按 OpenSpec 选择现有桌面壳能支持的受控溢出或右侧栏收缩方案；不要新增全局三栏拖拽系统。

验证：

- 左侧主导航关闭前后，中间聊天列宽度保持稳定或只出现过渡期内的极小变化。
- 右侧应用区域在左侧主导航关闭后变宽。
- 左侧主导航重新打开后，右侧栏优先收缩，中间对话区不被挤压。

### 切片 4: 强化 `ChatRightSidebar` 的 bounds 同步

目标：保证右侧应用区实际尺寸变化后，原生 `WebContentsView` 始终对齐 DOM 锚点。

涉及文件：

| 文件 | 操作 |
|------|------|
| `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue` | 校准 `ResizeObserver`、watch 条件、bounds 去重与延迟发送 |

实施步骤：

1. 确认 `viewAnchor` 只在 `activeTab === "app"` 时存在，并占满右侧内容区域。
2. `ResizeObserver` 只 observe 当前有效锚点；标签页切换、右侧栏关闭、组件卸载时断开 observer 并隐藏应用视图。
3. 在 `props.width`、`props.open`、`activeTab` 或拖拽结束后触发一次 `nextTick + sendBounds()`，补足 ResizeObserver 在 transition 或原生视图覆盖场景下可能漏发的问题。
4. 对 `sendBounds` 增加简单去重：如果 x/y/width/height 与上一次完全相同，不重复发送 IPC。
5. 保持 app 标签页不用 `ScrollArea`，因为 WebContentsView 是原生视图，会覆盖 renderer DOM。

验证：

- 拖拽右侧分隔条时 WebContentsView 跟随缩放。
- 左侧主导航开关后 WebContentsView 与右侧应用区域边界对齐。
- 切换到 `文件` 或 `设置/概要` 标签后 WebContentsView 不再盖住 renderer 内容。

### 切片 5: 样式与可用性收尾

目标：让布局符合 `DESIGN.md` 的桌面工作台标准，不引入营销式布局或新的视觉系统。

涉及文件：

| 文件 | 操作 |
|------|------|
| `app/work/src/renderer/src/pages/chat/Chat.vue` | 检查主聊天区、输入器、标题区的宽度约束 |
| `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue` | 检查右侧栏 transition、边框、内容区高度 |

实施步骤：

1. 中间输入器继续保留现有 `max-w-3xl`，但外层主聊天列不得低于最小宽度。
2. 不新增卡片套卡片、不新增装饰渐变或新的主题变量。
3. 右侧栏仍使用现有 `Sidebar`、`NavigationMenu`、`ScrollArea`、`Button` 等 shadcn 组件。
4. 检查窗口窄宽、左栏收起、右栏打开、应用标签激活四种组合，确保没有明显文本重叠或按钮溢出。

验证：

- 截图中的“开始工作 + 应用视图”布局在桌面宽度下保持稳定。
- 右侧导航标签仍可点击，文件数 badge 不挤压应用标签。

## 最终验证

1. `pnpm lint`
2. `pnpm build`
3. 手动验证：在当前工作空间根目录放置 `index.html`，打开右侧 `应用` 标签，页面正常加载。
4. 手动验证：没有 `index.html` 时显示友好的错误页。
5. 手动验证：拖拽右侧栏时，WebContentsView 同步缩放。
6. 手动验证：关闭左侧主导航时，中间对话区宽度稳定，右侧应用区自适应变宽。
7. 手动验证：重新打开左侧主导航、调整窗口宽度后，中间对话区不低于最小宽度，WebContentsView 不错位。

## 停止条件

- 如果实现发现左侧主导航实际宽度无法从现有 `SidebarProvider` 状态或 DOM 测量稳定取得，需要回到 `workflow-spec` 明确是否允许引入专用布局测量 composable。
- 如果 Electron 当前版本的 `WebContentsView` bounds 坐标与 `getBoundingClientRect()` 在 macOS 标题栏下存在稳定偏移，需要回到 OpenSpec 补充坐标修正要求。
- 如果窗口极窄时必须自动关闭右侧栏才能保证中间区最小宽度，需要回到 OpenSpec 明确该自动行为是否符合产品预期。

## 下一步

进入 `workflow-implement`，按切片 1 到切片 5 顺序实施。
