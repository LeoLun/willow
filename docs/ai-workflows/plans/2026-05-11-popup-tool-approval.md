# 实现计划：弹出式工具权限审批

日期：2026-05-11 | 变更：`popup-tool-approval`

## 执行顺序

```
Slice A: 读取设计稿 + PermissionApprovalPanel  （无依赖）
Slice B: ArkUserPanel 骨架                      （依赖 A 的结构知识）
Slice C: 简化 ToolMessage                       （无依赖）
Slice D: 更新包导出                             （依赖 A、B）
Slice E: 修改 Chat.vue 底部区域                  （依赖 A、D）
Slice F: 类型检查 + 视觉验证                     （依赖全部）
```

---

## Slice A：创建 PermissionApprovalPanel 组件

### A1. 读取设计稿
- 调用 `mcp__pencil__batch_get(filePath: "ui/work.pen", nodeIds: ["oZAzQ"], readDepth: 5)`
- 记录所有节点的精确属性值：padding、gap、cornerRadius、fontSize、fontWeight、fill、stroke、effect
- 记录颜色变量映射关系：`$--white` → `--background`，`$--foreground` → `--foreground`，`$--muted` → `--muted`，`$--muted-foreground` → `--muted-foreground`，`$--border` → `--border`

### A2. 创建组件文件
- 路径：`packages/ui/src/components/PermissionApprovalPanel.vue`
- 使用 `<script setup lang="ts">` + Composition API

### A3. 实现 Header 区域
- 容器：flex row, `alignItems: center`, `justifyContent: space-between`
- 标题 text：动态内容（prop 传入），fontSize 16px, fontWeight 600, lineHeight 1.45
- 关闭按钮：lucide `X` 图标 18×18，点击 emit `close`，cursor pointer

### A4. 实现 ChoiceList 区域
- 容器：flex col, padding top 22px（来自 `.pen` padding [22,0,0,0]）
- 每行（ChoiceRow）：flex row, gap 14px, height 64px, alignItems center
  - NumBadge：28×28px, cornerRadius 7px, muted 背景色, flex center, 内含序号文字（13px, fontWeight 500, muted-foreground）
  - ChoiceText：text "允许", fontSize 15px, foreground 色, 点击 emit `approve(toolCallId)`，cursor pointer
- 使用 `v-for` 遍历 `approvals` 数组生成多行

### A5. 实现 Footer 区域
- 容器：flex row, gap 12px, height 48px, alignItems center, padding top 10px
- 自定义拒绝区域（CustomInput）：flex row, gap 12px, fill_container, height 36px, alignItems center
  - EditBadge：28×28px, cornerRadius 7px, muted 背景, flex center, 内含 lucide `Pencil` 图标 15×15
  - CustomText："否"，fontSize 15px, muted-foreground 色
- 跳过按钮（SkipButton）：86×38px, cornerRadius 19px, white 背景（`--background`）, 1px border（`--border`）, flex center, cursor pointer
  - SkipText："跳过"，fontSize 15px, fontWeight 600, foreground 色
  - 点击 emit `skip`

### A6. 面板容器样式
- max-width: 856px（匹配输入框 `max-w-3xl`），width: 100%
- cornerRadius: 24px, 背景：`--background`
- border: 1px solid `--border`
- box-shadow: `0 10px 28px rgba(0,0,0,0.078)`（对应 `.pen` 的 `#00000014` ≈ 8% 透明度）
- padding: 22px 28px
- layout: flex col

### A7. 视觉校验
- 运行 `pnpm dev:ui`，导航到组件预览页面
- 调用 `mcp__pencil__get_screenshot` 截取 `oZAzQ` 设计稿
- 对比浏览器渲染效果与设计稿截图
- 如有偏差，修正 CSS 后重新对比

**停止条件**：组件渲染与设计稿像素级一致，关闭按钮和跳过按钮点击触发正确的 emit 事件。

---

## Slice B：创建 ArkUserPanel 骨架

### B1. 创建组件文件
- 路径：`packages/ui/src/components/ArkUserPanel.vue`

### B2. 复用布局结构
- 复制 PermissionApprovalPanel 的 header/choiceList/footer 三层布局骨架
- 替换实际内容为占位文本：
  - 标题：`"arkUser 工具审批（待实现）"`
  - 列表区域：单行占位文字 `"TODO: 待 arkUser 工具实现后接入"`
  - 底部：保留跳过按钮（功能同审批面板的 skip）
- 添加注释 `<!-- TODO: 待 arkUser 工具实现后接入实际审批逻辑 -->`

### B3. Props/Emits 预留
- props 定义为空对象或 `Record<string, never>`
- emits 预留 `skip` 和 `close` 事件

**停止条件**：组件文件存在，结构与审批面板一致，内容为骨架占位。

---

## Slice C：简化 ToolMessage 审批 UI

### C1. 移除内联审批操作区
- 文件：`packages/ui/src/components/ToolMessage.vue`
- 删除 `<div v-if="approval.status === 'pending'" class="mt-3 flex gap-2">` 及其内部的批准/拒绝 Button
- 删除 `onApprove` / `onReject` prop 定义（保留 `approval` prop）

### C2. 保留状态展示
- 保留 `v-if="approval"` 的卡片容器
- 保留 `approval.status === "pending" ? "工具调用等待审批" : "工具审批结果"` 的状态文字
- 保留 `approval.reason` 显示
- 保留 `argsSummary` 命令预览
- 保留 `approval.status !== "pending"` 时的 `"本次调用已批准"` / `"本次调用已拒绝"` 文字

### C3. 清理关联属性传递
- 检查 `AssistantMessage.vue`、`MessageList.vue`、`StreamingMessageContainer.vue` 是否仍需向下传递 `onApproveToolCall` / `onRejectToolCall`
- 如果 `ToolMessage` 不再需要它们，从 props 和模板绑定中移除
- **注意**：`Chat.vue` 仍需要这些回调用于审批面板，不要删除 Chat.vue 中的 `handleToolApproval`

**停止条件**：ToolMessage 不再显示批准/拒绝按钮，但 pending/approved/rejected 状态文字仍然可见。

---

## Slice D：更新包导出

### D1. 导出新组件
- 文件：`packages/ui/src/index.ts`
- 添加：
  ```typescript
  export { default as PermissionApprovalPanel } from "./components/PermissionApprovalPanel.vue";
  export { default as ArkUserPanel } from "./components/ArkUserPanel.vue";
  ```

### D2. 类型检查
- 运行 `pnpm exec tsc --noEmit -p packages/ui/tsconfig.json`
- 修复任何类型错误

**停止条件**：新组件可被其他包 import，类型检查无错误。

---

## Slice E：修改 Chat.vue 底部区域

### E1. 计算 pendingApprovals
- 文件：`app/work/src/renderer/src/pages/chat/Chat.vue`
- 新增 computed：
  ```typescript
  const pendingApprovals = computed(() =>
    Array.from(state.toolApprovals.values()).filter(a => a.status === "pending")
  );
  ```

### E2. 条件渲染
- 用 `<PermissionApprovalPanel>` 和 `<SenderContainer>` 的 `v-if`/`v-else` 互斥替换：
  ```html
  <PermissionApprovalPanel
    v-if="pendingApprovals.length > 0"
    :approvals="pendingApprovals"
    @approve="(id) => handleToolApproval(id, 'approved')"
    @reject="(id) => handleToolApproval(id, 'rejected')"
    @skip="handleSkipApproval"
    @close="handleSkipApproval"
  />
  <SenderContainer v-else ... />
  ```

### E3. skip/close 处理函数
- 新增 `handleSkipApproval()`：
  ```typescript
  async function handleSkipApproval() {
    // 1. 拒绝所有 pending 审批
    for (const approval of pendingApprovals.value) {
      await electronAPI.resolveToolApproval({
        sessionId: sessionId.value,
        toolCallId: approval.toolCallId,
        decision: "rejected",
      });
    }
    // 2. 停止会话流
    await handleStop();
  }
  ```

### E4. 移除消息层审批回调传递（如适用）
- 如果 Slice C 已从 `ToolMessage` 移除 `onApprove`/`onReject`，同步从 `Session.vue` 的 props 和模板绑定中移除对应的 `onApproveToolCall`/`onRejectToolCall`
- **保留** `toolApprovals` 的传递（审批面板和 ToolMessage 的状态展示仍需这些数据）

**停止条件**：有 pending 审批时显示面板，无审批时显示输入框；skip/close 触发后会话停止。

---

## Slice F：类型检查 + 视觉验证

### F1. 全量类型检查
- 运行 `pnpm lint` 确保 oxlint 通过
- 运行 `pnpm format:check` 确保格式化通过
- 运行 `pnpm exec tsc --noEmit`（或项目配置的类型检查命令）确保无类型错误

### F2. UI  playground 验证
- 运行 `pnpm dev:ui`
- 在浏览器中查看 PermissionApprovalPanel 的独立渲染效果
- 验证 panel 宽度、圆角、阴影、间距是否与设计稿一致

### F3. 完整流程验证
- 运行 `pnpm dev`
- 触发一个需要审批的工具调用（如对工作区外的文件执行 write 操作）
- 验证：
  1. 审批面板出现在底部输入框位置 ✓
  2. 面板宽度与输入框一致 ✓
  3. 点击"允许"→ 面板消失，工具执行 ✓
  4. 点击"跳过"→ 会话停止 ✓
  5. 点击"关闭"→ 会话停止 ✓
  6. 消息流中工具调用状态正确显示 ✓

**停止条件**：所有场景通过，无控制台错误。

---

## 依赖与假设

| 依赖 | 状态 |
|------|------|
| `ToolApprovalCoordinator` 正常工作 | 已验证 |
| IPC 通道 `RESOLVE_TOOL_APPROVAL` / `STOP_SESSION_STREAM` 已存在 | 已验证 |
| `state.toolApprovals` 在 Chat.vue 中可访问 | 已验证 |
| lucide-vue-next 图标库已安装 | 已验证 |

## 风险

| 风险 | 缓解 |
|------|------|
| 审批面板出现/消失时布局跳动 | 面板与 SenderContainer 使用相同的容器宽度（`max-w-3xl` + `w-full`） |
| 多个 pending 审批时的 UI 拥挤 | choiceList 可滚动（`max-height` + `overflow-y: auto`） |
| 主题切换后颜色不匹配 | 使用 CSS 变量映射 `.pen` 颜色到主题 token |
