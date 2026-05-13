# Update Sender Enter Send Implementation Plan

## Scope

对应 OpenSpec change：

- `docs/ai-workflows/openspec/changes/update-sender-enter-send/proposal.md`
- `docs/ai-workflows/openspec/changes/update-sender-enter-send/design.md`
- `docs/ai-workflows/openspec/changes/update-sender-enter-send/tasks.md`
- `docs/ai-workflows/openspec/changes/update-sender-enter-send/specs/sender-input-shortcuts/spec.md`

目标是调整聊天发送器的键盘输入语义：普通输入态下 `Enter` 直接发送当前消息，`Shift+Enter` 插入换行；技能选择面板或文件选择面板打开时，`Enter` 继续确认当前高亮项，不触发消息发送。

本计划只覆盖 `@willow/sender` 的键盘事件分流，不改发送 payload、宿主 API、输入器视觉结构或其他编辑器能力。

## Assumptions

- 现有 `packages/sender/src/components/Editor.vue` 已通过 Tiptap `editorProps.handleKeyDown` 调用 `props.onKeyDown`，适合作为本次键盘分流入口。
- 现有 `packages/sender/src/components/Sender.vue` 的 `handleSend()` 已包含未配置模型和空消息校验，`Enter` 发送必须复用该方法。
- `Shift+Enter` 应由 Tiptap/ProseMirror 默认行为处理；实现只需要在该组合键下不拦截事件。
- 流式输出中的 `Enter` 不定义为停止快捷键，本次仅约束发送前输入态。

## Implementation Slices

### 1. 确认当前键盘事件流

涉及文件：

- `packages/sender/src/components/Editor.vue`
- `packages/sender/src/components/Sender.vue`

步骤：

- 确认 `Editor.vue` 的 `handleKeyDown` 在 `props.onKeyDown?.(event)` 返回 `true` 时会拦截 Tiptap 默认行为。
- 确认 `props.onKeyDown` 返回 `false` 或 `undefined` 时，事件会继续交给 Tiptap 默认处理。
- 确认 `Sender.vue` 的 `handleEditorKeyDown()` 当前只在 picker 打开时处理 `ArrowUp`、`ArrowDown`、`Enter`、`Escape`。

验证：

- 确认本次不需要新增 `Editor.vue` emit 或修改 `Sender` 对外 props/events。
- 确认普通输入态可以只通过扩展 `handleEditorKeyDown()` 完成需求。

### 2. 实现普通输入态 `Enter` 发送

涉及文件：

- `packages/sender/src/components/Sender.vue`

步骤：

- 在 `handleEditorKeyDown(event)` 中保留现有 picker 优先分支。
- 当没有任何 picker 打开，且 `event.key === "Enter"`、`event.shiftKey === false` 时：
  - 调用 `event.preventDefault()`，避免编辑器插入换行。
  - 调用 `void handleSend()`，复用现有模型校验、空消息校验、payload 组装和发送后清空逻辑。
  - 返回 `true`，告知 `Editor.vue` 本次按键已被发送器处理。
- 不新增绕过 `handleSend()` 的发送分支。

验证：

- 普通非空文本按 `Enter` 会触发一次 `send`。
- 未配置模型时按 `Enter` 仍显示当前“请先前往设置配置模型”的反馈。
- 空白草稿按 `Enter` 不发送，且不插入额外空行。

### 3. 保留 `Shift+Enter` 换行

涉及文件：

- `packages/sender/src/components/Sender.vue`
- 如现有 Tiptap 默认行为不满足，再最小调整 `packages/sender/src/components/Editor.vue`

步骤：

- 在普通输入态下，当 `event.key === "Enter"` 且 `event.shiftKey === true` 时返回 `false`，让编辑器执行默认换行。
- 不调用 `handleSend()`。
- 不清空 `editorText`、技能标签、文件标签、模型选择或网络搜索状态。
- 如果 Tiptap 默认 `Shift+Enter` 未产生可见换行，再评估是否需要在 `Editor.vue` 或 StarterKit 配置中补充硬换行能力；若需要新增编辑器能力且超出当前规格，应先停止并回到 `workflow-spec`。

验证：

- 输入普通文本后按 `Shift+Enter`，编辑区出现新行。
- 换行后继续输入并按 `Enter`，发送内容保留多行语义。
- `Shift+Enter` 不触发 `send`。

### 4. 保护 picker 键盘优先级

涉及文件：

- `packages/sender/src/components/Sender.vue`
- `packages/sender/src/composables/useTriggerManager.ts`，仅在发现现有面板状态判断不准确时查看，不作为默认修改目标

步骤：

- 保持 `triggerManager.isAnyPanelVisible.value` 为键盘优先级判断的第一层。
- picker 打开时维持现有 `Enter` 逻辑：
  - 技能面板中选择 `skillPickerPanelRef.value?.filteredSkills[activeIndex]`
  - 文件面板中选择 `filePickerPanelRef.value?.filteredFiles[activeIndex]`
  - 选择后清理触发文本并关闭面板
- 保持 `ArrowUp`、`ArrowDown`、`Escape` 的现有处理不变。
- 避免把普通输入态 `Enter` 发送逻辑放到 picker 分支之前。

验证：

- 输入 `/` 打开技能面板后按 `Enter` 只插入技能标签，不发送消息。
- 输入 `@` 打开文件面板后按 `Enter` 只插入文件标签，不发送消息。
- 面板打开时 `ArrowUp`、`ArrowDown` 仍移动高亮项，`Escape` 仍关闭面板。

### 5. 检查任务状态与文档一致性

涉及文件：

- `docs/ai-workflows/openspec/changes/update-sender-enter-send/tasks.md`

步骤：

- 实现完成后，将已完成的任务勾选为 `[x]`。
- 只勾选实际完成并验证过的条目。
- 不新增 OpenSpec 外的并行需求说明。

验证：

- `tasks.md` 勾选状态与实现、验证结果一致。

### 6. 检查命令

优先运行：

- `pnpm lint`

如 lint 暴露类型或构建相关风险，继续运行：

- `pnpm build`

手动验证建议：

- 启动 `pnpm dev`，在聊天输入区验证普通 `Enter`、`Shift+Enter`、slash 技能面板和 `@` 文件面板。
- 若完整 Electron 启动受环境限制，在最终说明中明确未完成的手动验证项，并至少完成静态检查。

## Stop Conditions

- 如果 `Shift+Enter` 无法在当前 Tiptap 配置下插入可见换行，并且需要引入新的编辑器扩展或改变内容序列化语义，停止并回到 `workflow-spec`。
- 如果 `Enter` 发送需要改变 `SenderSendPayload`、宿主 `SenderContainer` 或主进程发送协议，停止并回到 `workflow-spec`。
- 如果 picker 打开状态无法可靠区分普通输入态和面板态，先停止查明现有 trigger 管理语义，避免实现误发送。
- 如果实现需要把 `Enter` 在流式输出中定义为停止快捷键，停止并回到 `workflow-spec`，因为当前规格明确不包含该行为。

## Handoff To workflow-implement

执行时优先保持变更集中在：

- `packages/sender/src/components/Sender.vue`

只有在验证发现 `Shift+Enter` 默认换行无法工作时，才评估是否触碰：

- `packages/sender/src/components/Editor.vue`

完成后更新 OpenSpec `tasks.md`，运行相关检查，并在最终说明中列出已验证的键盘场景。
