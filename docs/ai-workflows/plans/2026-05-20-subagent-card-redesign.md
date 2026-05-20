# 子 Agent 委派卡片 UI 重设计 — 执行计划

本项目旨在将 `WorkspaceDelegateToolRenderer.vue` 从折叠式设计（`ToolCallCard`）重构为紧凑、无折叠的行内卡片布局，且支持实时展示子 Agent 的执行步骤，并在 hover 时显示 `>` 箭头点击跳转到对应的子会话。

## 1. 依赖关系

```
1. App.vue (扩展注册接口) ──→ 2. registry.ts & factory (透传 props) ──→ 3. Renderer.vue (卡片重构与状态订阅)
                                                                                  │
                                                                                  ↓
                                                                             4. 静态编译与运行验证
```

---

## 2. 任务细分

### 任务 1：扩展前端工具渲染器注册接口

#### 1.1 修改 `packages/ui/src/renderers/registry.ts`
- 在 `registryAllToolRenderers` 的 `options` 参数中，扩展两个新函数定义：
  - `onGetSessionHistory?: (sessionId: number) => Promise<any>`：获取指定会话的当前历史与状态。
  - `onSubscribeSessionUpdate?: (sessionId: number, callback: (event: any) => void) => () => void`：订阅指定会话的实时消息更新事件。
- 在注册 `workspace_delegate` 工具渲染工厂时，将这两个参数传递给 `WorkspaceDelegateRendererFactory`。

#### 1.2 修改 `packages/ui/src/renderers/WorkspaceDelegateRendererFactory.ts`
- 在 `WorkspaceDelegateRendererOptions` 中添加 `onGetSessionHistory` 和 `onSubscribeSessionUpdate` 两个可选的属性。
- 在 `render` 方法返回的 `props` 中将这两个回调透传。

#### 1.3 修改 `app/work/src/renderer/src/App.vue`
- 在调用 `registryAllToolRenderers` 时提供新增加的两个回调：
  - `onGetSessionHistory`:
    ```typescript
    onGetSessionHistory: async (sessionId: number) => {
      return window.electronAPI.getSessionHistory({ sessionId });
    }
    ```
  - `onSubscribeSessionUpdate`:
    ```typescript
    onSubscribeSessionUpdate: (sessionId: number, callback: (event: any) => void) => {
      const { addEventListener, removeEventListener } = useEventBus();
      const handleUpdate = (data: any) => {
        if (data.sessionId === sessionId) {
          callback(data.event);
        }
      };
      addEventListener("UPDATE_MESSAGE", handleUpdate);
      return () => removeEventListener("UPDATE_MESSAGE", handleUpdate);
    }
    ```

---

### 任务 2：重写子 Agent 委派渲染器组件

#### 2.1 重构 `packages/ui/src/renderers/WorkspaceDelegateToolRenderer.vue`
- **移除外部组件依赖**：不再导入或使用 `ToolCallCard.vue`、`Button`、`MarkdownBlock` 等组件。
- **添加 props 声明**：
  ```typescript
  onGetSessionHistory?: (sessionId: number) => Promise<any>;
  onSubscribeSessionUpdate?: (sessionId: number, callback: (event: any) => void) => () => void;
  ```
- **实时状态订阅逻辑**：
  - 定义三个 `ref` 变量：
    - `childIsStreaming = ref(false)`
    - `childLastStepText = ref('')`
  - 使用 `watch` 监听 `childSessionId`。当变化时：
    - 清理旧的订阅。
    - 调用 `onGetSessionHistory` 异步获取子会话初始状态，如果存在 `activeStream` 则调用辅助解析函数并更新 `childIsStreaming` 和 `childLastStepText`。
    - 调用 `onSubscribeSessionUpdate` 订阅实时消息，并保存退订回调。
- **实时消息解析辅助函数**：
  - 解析 `UPDATE_MESSAGE` 事件中的类型，更新 `childLastStepText` 的值：
    - `tool_execution_start`/`tool_execution_update`：根据工具名展示友好名称（例如 `bash` -> `执行终端命令`, `read` -> `读取文件` 等）。
    - `message_start`/`message_update`：检查最后一个 chunk 是否为思考块（`正在思考...`）或文本块（`正在回复...`）。
    - `agent_end`：设为运行结束。
- **自定义行内卡片 DOM & 样式**：
  - 最外层使用 `relative flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30 transition-all duration-200` 布局。
  - Hover 时，添加 `hover:bg-muted/30` 样式；如果不含 `childSessionId`，则是 `cursor-default`。
  - 点击卡片整体时，若有 `childSessionId`，触发 `navigateToChildSession` 导航。
  - **左侧状态点**：使用圆点或图标展示状态：
    - 运行中（`state === 'running' || childIsStreaming`）：显示 `Loader2` 旋转动画。
    - 完成：显示 `CheckCircle2` (绿标)。
    - 失败：显示 `XCircle` (红标)。
    - 等待中：显示 `Loader2`（不旋转或灰色）。
  - **中间内容区**：
    - 标题文字：`委派「{workspaceName} / {agentName}」`。
    - 状态详情文字：根据运行状态，如果有 `childLastStepText` 优先展示，否则降级显示 `statusDetailText` (例如 `正在委派执行中...` 等)。
  - **右侧箭头**：
    - 导入 `ChevronRight` 图标。
    - 整个卡片 hover 时展示（利用 Tailwind `opacity-0 group-hover:opacity-100 transition-opacity` 实现平滑过渡）。
    - 点击事件同样触发跳转。

---

## 3. 验证

### 3.1 静态检查与编译
- 运行 `pnpm lint` 执行代码风格与语法规则校验。
- 运行 `pnpm build` 重新编译 packages 和 Electron 项目，确保零编译错误。

### 3.2 手动与行为校验
- 启动应用 `pnpm dev`。
- 新建/进入对话，并提及一个子 Agent 执行操作（例如调用 `workspace_delegate` ）。
- 验证卡片没有展开收起态，标题和状态在上下两行直接呈现。
- 在子 Agent 运行期间，验证状态描述文字是否根据子 Agent 内部步骤（如思考中、运行工具中）实时改变。
- 验证 hover 态下，右侧渐显 `>` 箭头。
- 验证点击卡片能够无缝跳转到对应的子会话，且跳转后历史会话正常同步。

---

## 4. 转向执行

本计划一经确认，将立即进入 `workflow-implement` 阶段，对这四个部分进行编码实现。
