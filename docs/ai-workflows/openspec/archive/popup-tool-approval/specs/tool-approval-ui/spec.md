# 工具审批 UI 规范

## 场景 1：弹出式审批面板替代输入框

**Given** 用户正在会话中，AI 发起了一个需要审批的工具调用（如高危 bash 命令 `rm -rf a.js`）
**When** 审批状态变为 `pending`
**Then** 底部输入框区域被 `PermissionApprovalPanel` 替换
**And** 面板宽度与输入框一致（`max-w-3xl`，居中）
**And** 面板标题为统一格式 `"是否允许执行 <操作摘要>"`（如 `"是否允许执行 rm -rf a.js"`）
**And** 每个待审批项显示为一行，行内仅含编号徽章 + "允许" 文字
**And** 点击整行即可批准该工具调用（无需额外按钮）

## 场景 1b：标题生成规则

**Given** 工具调用需要审批
**When** 生成审批面板标题
**Then** 标题格式为 `"是否允许执行 <操作摘要>"`
**And** 对于 bash 工具，操作摘要为命令字符串（如 `rm -rf a.js`）
**And** 对于 write/edit 工具，操作摘要为文件路径（如 `/path/to/file.ts`）
**And** 对于其他工具，操作摘要为工具名 + 关键参数

## 场景 2：批准后继续执行

**Given** 审批面板正在显示
**When** 用户点击"允许"批准了工具调用
**Then** 面板消失，输入框恢复显示
**And** 工具调用继续执行
**And** 会话流不中断

## 场景 2b：点击跳过停止会话

**Given** 审批面板正在显示
**When** 用户点击"跳过"按钮
**Then** 所有 pending 审批被拒绝
**And** 当前会话流被停止（调用 `stopSessionStream`）
**And** 面板消失，输入框恢复显示

## 场景 2c：点击关闭停止会话

**Given** 审批面板正在显示
**When** 用户点击标题行关闭图标（X）
**Then** 所有 pending 审批被拒绝
**And** 当前会话流被停止（调用 `stopSessionStream`）
**And** 面板消失，输入框恢复显示

## 场景 3：审批面板像素级设计还原

**Given** `ui/work.pen` 中 `askPermPanel`（id: `oZAzQ`）的设计稿
**When** 实现审批面板时
**Then** 必须先用 Pencil MCP 工具实时读取 `askPermPanel` 节点完整结构
**And** 所有 CSS 参数（间距、字号、颜色、圆角、阴影等）以 `.pen` 实际值为准
**And** 面板视觉像素级还原设计稿：
  - 白色背景、24px 圆角、1px 边框、外部阴影（blur 28, y+10, #00000014）
  - 标题行包含标题文字（16px、fontWeight 600、lineHeight 1.45）和关闭图标（18×18）
  - 选择列表每项包含：28×28 圆角7px 编号徽章 + 选项文字（15px）
  - 底部包含：编辑图标（15×15）+ "否"文字（15px）的自定义拒绝区域，以及 "跳过" 圆角按钮（86×38、cornerRadius 19、白底+边框）
**And** 实现后使用 `get_screenshot` 截取与设计稿对比校验

## 场景 4：arkUser 面板预留

**Given** 未来将实现 `arkUser` 工具
**When** 需要在审批面板同样位置显示 `ArkUserPanel`
**Then** 存在 `ArkUserPanel.vue` 组件文件
**And** 组件结构与 `PermissionApprovalPanel` 一致（相同的 header、list、footer 布局）
**And** 组件内容为骨架占位，标记 TODO 待后续实现

## 场景 6：自定义拒绝原因

**Given** 审批面板正在显示
**When** 用户点击底部"否"区域
**Then** 出现内联输入框，用户可输入拒绝原因
**And** 用户按 Enter 或点击确认后，自定义原因随 reject 事件发出
**And** 拒绝原因透传至 LLM，替代默认的 `"用户拒绝了本次工具调用"`
**And** 若用户未输入原因直接确认，使用默认拒绝原因

## 场景 7：多个待审批项

**Given** 有多个工具调用同时等待审批
**When** 审批面板渲染
**Then** 每个待审批项在 choiceList 中独立显示为一行
**And** 每行有独立的编号和"允许"选项
**And** 用户可逐条批准或拒绝每个工具调用
