# Sender Input Shortcuts Spec

## ADDED Requirements

### Requirement: Send Message With Enter In Normal Input State

聊天发送器 SHALL 在普通输入态下将 `Enter` 作为发送当前消息的快捷键。

#### Scenario: Send non-empty message with Enter

- **GIVEN** 用户正在聊天输入区编辑一条非空消息
- **AND** 当前没有技能选择面板或文件选择面板处于激活状态
- **WHEN** 用户按下 `Enter`
- **THEN** 系统触发一次与点击主发送按钮等价的发送动作
- **AND** 不向编辑器插入额外换行

#### Scenario: Prevent sending blank content with Enter

- **GIVEN** 用户正在聊天输入区编辑一条仅包含空白内容的草稿
- **AND** 当前没有技能选择面板或文件选择面板处于激活状态
- **WHEN** 用户按下 `Enter`
- **THEN** 系统不会发送该消息
- **AND** 不会因为本次按键提交空白内容

### Requirement: Insert Newline With Shift Enter

聊天发送器 SHALL 将 `Shift+Enter` 作为显式换行操作，而不是发送操作。

#### Scenario: Insert newline in the current draft

- **GIVEN** 用户正在聊天输入区编辑消息
- **AND** 当前没有技能选择面板或文件选择面板处于激活状态
- **WHEN** 用户按下 `Shift+Enter`
- **THEN** 编辑器在当前位置插入换行
- **AND** 当前草稿不会被发送

### Requirement: Keep Picker Enter Semantics Higher Priority Than Send

当输入器的技能选择面板或文件选择面板处于激活状态时，系统 SHALL 让 `Enter` 优先服务于面板确认，而不是触发发送。

#### Scenario: Confirm skill selection with Enter

- **GIVEN** slash 技能选择面板已打开
- **AND** 当前存在高亮的技能候选项
- **WHEN** 用户按下 `Enter`
- **THEN** 系统确认当前高亮技能
- **AND** 移除对应的触发查询文本
- **AND** 关闭技能面板
- **AND** 不触发消息发送

#### Scenario: Confirm file selection with Enter

- **GIVEN** `@` 文件选择面板已打开
- **AND** 当前存在高亮的文件候选项
- **WHEN** 用户按下 `Enter`
- **THEN** 系统确认当前高亮文件
- **AND** 移除对应的触发查询文本
- **AND** 关闭文件面板
- **AND** 不触发消息发送

### Requirement: Preserve Existing Send Validation And Post Send Behavior

键盘发送快捷键 SHALL 复用现有发送链路的校验和发送后状态处理，不得绕过既有保护逻辑。

#### Scenario: Reuse model validation before Enter send

- **GIVEN** 用户输入了可发送的文本内容
- **AND** 当前没有可用的已选模型
- **WHEN** 用户按下 `Enter`
- **THEN** 系统不会真正发送消息
- **AND** 继续沿用当前未配置模型时的提示或引导行为

#### Scenario: Clear draft after successful Enter send

- **GIVEN** 用户通过 `Enter` 成功发送了一条消息
- **WHEN** 发送器回到下一轮待输入状态
- **THEN** 输入区按当前产品语义清空本轮草稿
- **AND** 不保留已成功发送的临时输入内容

#### Scenario: Keep stop action unchanged during streaming

- **GIVEN** 当前会话正在流式输出中
- **WHEN** 用户查看发送器主操作区域
- **THEN** 主操作仍保持停止语义
- **AND** 本次变更不会把 `Enter` 重新定义为流式状态下的停止快捷键
