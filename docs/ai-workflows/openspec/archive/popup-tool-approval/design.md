# 设计文档：弹出式工具权限审批

## 架构决策

### 审批面板显示位置

审批面板从消息流内（`ToolMessage.vue`）移至 `Chat.vue` 底部输入区域，与 `SenderContainer` 互斥渲染：

```
Chat.vue 底部区域
├── SenderContainer     （无 pending 审批时显示）
└── PermissionApprovalPanel  （有 pending 审批时显示）
```

**理由**：面板替换输入框而非覆盖在其上方，确保用户焦点集中在审批操作上。面板宽度与输入框一致（`max-w-3xl` = 864px，与 UI 稿 856px 匹配），视觉上形成"输入区域临时变为审批区域"的过渡感。

### 审批状态提升

当前 `toolApprovals` 从 `Chat.vue` → `Session.vue` → `MessageList` → `AssistantMessage` → `ToolMessage` 层层传递。审批面板需要同样的数据，但不需要改动传递链——`Chat.vue` 已通过 `useAgentMessages` 持有 `state.toolApprovals`。

新增 computed 属性 `pendingApprovals`（从 `state.toolApprovals` 过滤 `status === "pending"`）来决定是否显示审批面板。

### 多审批处理

当前系统一次通常只有一个 pending 审批。若出现多个，面板列表逐条展示，用户可逐条操作。

## UI 设计还原（基于 askPermPanel）

**强约束**：实现时必须使用 Pencil MCP 工具实时读取 `ui/work.pen` 中 `askPermPanel` 节点（id: `oZAzQ`），以设计稿为准进行像素级还原。以下参数仅作为参考摘要，实际值以 `.pen` 文件为准。

从 `ui/work.pen` 的 `askPermPanel` 节点提取的设计参数：

| 属性 | 值 |
|------|-----|
| 宽度 | 856px（跟随输入框 `max-w-3xl`） |
| 圆角 | 24px |
| 背景 | `$--white`（适配主题后为 `--background`） |
| 边框 | 1px `$--border` |
| 阴影 | `0 10px 28px rgba(0,0,0,0.08)` |
| 内边距 | 22px 28px |
| 布局 | 垂直 flex，不加 gap（子元素自行控制间距） |

### 组件结构

```
PermissionApprovalPanel
├── Header（flex row, gap 16, alignItems center）
│   ├── Title（text, fontSize 16, fontWeight 600）
│   └── CloseButton（icon: x, 18×18）
├── ChoiceList（vertical flex, 无 gap, padding top 22）
│   └── ChoiceRow（flex row, gap 14, height 64, alignItems center）
│       ├── NumBadge（28×28, cornerRadius 7, muted 背景, 居中）
│       │   └── NumText（fontSize 13, fontWeight 500）
│       └── ChoiceText（fontSize 15, fill_container）
└── Footer（flex row, gap 12, height 48, alignItems center, padding top 10）
    ├── CustomInput（flex row, gap 12, fill_container, height 36, alignItems center）
    │   ├── EditBadge（28×28, cornerRadius 7, muted 背景, 居中）
    │   │   └── EditIcon（pencil, 15×15）
    │   └── CustomText（fontSize 15, muted-foreground）
    └── SkipButton（86×38, cornerRadius 19, white 背景, border, 居中）
        └── SkipText（fontSize 15, fontWeight 600）
```

## 组件接口

### PermissionApprovalPanel

```typescript
defineProps<{
  approvals: ToolApproval[];  // 当前 pending 的审批列表
}>();

defineEmits<{
  approve: [toolCallId: string];                  // 批准单个工具调用（点击整行触发）
  reject: [toolCallId: string, reason?: string];  // 拒绝单个工具调用
  skip: [];                                        // 跳过 → 停止会话
  close: [];                                       // 关闭 → 停止会话
}>();
```

### 标题生成规则

标题不再直接使用 `approval.reason`，改为统一格式 `"是否允许执行 <操作摘要>"`：

| 工具类型 | 操作摘要来源 | 示例 |
|---------|-------------|------|
| bash | `arguments.command` | `是否允许执行 rm -rf a.js` |
| write | `arguments.filePath` | `是否允许执行写入 /etc/config.yml` |
| edit | `arguments.filePath` | `是否允许执行编辑 /etc/config.yml` |
| 其他 | 工具名 + 关键参数 | `是否允许执行 webfetch https://example.com` |

### 行交互模式

每个 choice row 整体可点击，点击即触发 `approve(toolCallId)`。行内仅包含：
- 编号徽章（28×28，cornerRadius 7，muted 背景）
- "允许" 文字（15px）

不添加额外的按钮元素。整行 hover 时视觉反馈（如背景微变）。

### 自定义拒绝原因

"否"区域点击后展开内联输入框，用户输入拒绝原因提交后透传至 LLM。

**UI 交互**：
```
Footer
├── 默认状态：pencil 图标 + "否" 文字
└── 激活状态（点击后）：
    ├── 内联 input[type="text"]，占位 "输入拒绝原因..."
    └── 确认按钮（或 Enter 提交），取消恢复默认状态
```

**数据流**：
```
UI emit('reject', toolCallId, reason)
  → Chat.vue handleToolApproval(id, 'rejected', reason)
    → electronAPI.resolveToolApproval({ sessionId, toolCallId, decision: 'rejected', reason })
      → IPC → ResolveToolApprovalController → SessionService
        → CoreAgent 存储 rejectionReason
          → setBeforeToolCall 返回 { block: true, reason: `<用户输入>` || "用户拒绝了本次工具调用" }
```

**涉及改动**：
| 层级 | 文件 | 改动 |
|------|------|------|
| UI | `PermissionApprovalPanel.vue` | "否"区域点击切换输入框，Enter 或确认 emit `reject(id, reason)` |
| 共享类型 | `api.ts` | `ResolveToolApprovalRequest` 加 `reason?: string` |
| 控制器 | `resolve.tool.approval.controller.ts` | 传递 `reason` |
| 服务 | `session.service.ts` | 透传 `reason` |
| 核心 | `core-agent.ts` | 存储 rejectionReason，拒绝时使用自定义原因 |

**skip/close 语义**：用户点击"跳过"或"关闭"表示不想批准此次工具调用，AI 无法继续执行，因此需要停止整个会话。Chat.vue 收到 `skip`/`close` 事件后会依次：
1. 拒绝所有 pending 的审批（让 agent 的 Promise 以 rejected 状态 resolve，agent 正常结束等待）
2. 调用 `electronAPI.stopSessionStream()` 停止会话流

### ArkUserPanel（预留）

```typescript
defineProps<{
  // 待 arkUser 工具实现后定义
}>();

defineEmits<{
  // 待 arkUser 工具实现后定义
}>();
```

## 实现约束

1. **像素级还原**：实现 `PermissionApprovalPanel.vue` 时，必须先用 Pencil MCP 工具的 `batch_get` 读取 `ui/work.pen` 中 `askPermPanel` 节点（id: `oZAzQ`）的完整结构，按 `.pen` 文件中的实际值编写 CSS
2. **不依赖记忆值**：所有间距、字号、颜色、圆角等参数均以 `.pen` 文件的实时读取结果为准，不使用本文档中的摘要值
3. **视觉校验**：实现完成后使用 `get_screenshot` 截取审批面板截图与设计稿对比

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/ui/src/components/PermissionApprovalPanel.vue` | 新建 | 审批弹出面板 |
| `packages/ui/src/components/ArkUserPanel.vue` | 新建 | arkUser 工具预留面板（骨架） |
| `packages/ui/src/index.ts` | 修改 | 导出新组件 |
| `app/work/src/renderer/src/pages/chat/Chat.vue` | 修改 | 底部区域条件渲染面板 + skip/close 停止会话 |
| `packages/ui/src/components/ToolMessage.vue` | 修改 | 移除内联审批 UI，保留已审批状态 |
