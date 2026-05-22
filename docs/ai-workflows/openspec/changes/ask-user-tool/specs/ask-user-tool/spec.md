# ask_user 工具规范

## 需求

### R1: `ask_user` 工具定义

系统 MUST 注册一个名为 `ask_user` 的内置工具，参数定义如下：
- `question` (string, required): 提示用户的具体问题。
- `options` (array of string, required): 供用户选择的 2~4 个候选项，数组长度 MUST 在 2 到 4 之间。

### R2: 异步等待与通信

当 `ask_user` 被调用时：
- 它 MUST 使用 `ToolApprovalCoordinator` 触发一个特殊的 toolCall 请求。
- 它 MUST 异步等待用户决策，直到被 resolve（用户选择、输入或跳过/关闭）。
- `ToolApprovalCoordinator` MUST 扩展以支持携带 `reason`（用户的回答内容）的决策返回。

### R3: `AskUserPanel` 界面组件

系统 MUST 实现并渲染 `AskUserPanel.vue`：
- **标题区**：展示 `question` 内容。包含一个关闭图标 `X`。
- **选项列表区**：展示 `options` 列表中的 2~4 个候选项。
  - 每个选项以序号 `1` 至 `N` 开头，背景为 `bg-muted`。
  - 点击某个选项，即视同选择该回答，直接触发提交并 resolve 对应的 toolCall。
- **自定义输入与操作区**：
  - 左侧为一个带铅笔图标的文本输入框，占位提示为“输入其他”。
  - 右侧为“跳过”或“提交”按钮：
    - 若输入框为空，显示“跳过”按钮；
    - 若输入框有内容，显示“提交”按钮。
  - 在输入框内按下回车（Enter）或点击“提交”按钮，将输入内容作为回答，触发提交并 resolve 对应的 toolCall。
  - 点击“跳过”或顶部关闭 `X` 按钮，直接 reject 该请求。

### R4: 页面集成与互斥

- 当 `state.toolApprovals` 中存在 toolName 为 `"ask_user"` 且 status 为 `"pending"` 的请求时，主界面 `Chat.vue` MUST 优先渲染 `AskUserPanel`。
- `AskUserPanel` MUST 覆盖原输入框组件 `SenderContainer`。

### R5: 工具返回

- 用户选择候选项或输入自定义文字时，工具 MUST 成功返回用户选定的文本内容。
- 用户跳过或关闭问题时，工具 MUST 返回提示文字，例如 `"用户跳过了该问题或未作答。"`，以便 AI 能够感知到并继续后续任务。

## 验收标准

- [ ] AI 在调用 `ask_user` 时，系统底部弹出 `AskUserPanel`。
- [ ] 选项个数在 2~4 个时能正确排版，文字清晰易读。
- [ ] 点击选项直接提交，AI 接收到的工具输出为该选项的文本。
- [ ] 在输入框中输入自定义文本并按回车或点击提交，AI 接收到的工具输出为自定义文本。
- [ ] 点击跳过或关闭按钮，AI 接收到的工具输出为“用户跳过了该问题或未作答。”且 AI 能继续执行后续任务。
- [ ] 没有 `ask_user` 时，输入框表现正常。
