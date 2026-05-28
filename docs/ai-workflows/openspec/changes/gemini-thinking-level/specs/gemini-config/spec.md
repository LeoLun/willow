# 思考模型与思考程度选择规范

## 需求

### R1: 模型下拉菜单动态展开

对于系统中任何配置了 `reasoning: true` 的可用模型，在聊天界面的模型选择下拉菜单中，MUST 动态展示为以下三个子选项：
1. `[模型名称] (Medium)` —— 对应选中值：`[modelId]:medium`
2. `[模型名称] (High)` —— 对应选中值：`[modelId]:high`
3. `[模型名称] (Low)` —— 对应选中值：`[modelId]:low`

对于 `reasoning: false` 的普通模型，保持展示原选项，对应选中值为 `[modelId]`。

### R2: 前端选中状态与名称回显

1. 选中带思考程度的选项后，输入框底部的模型触发按钮文字 MUST 格式化显示为：`[模型名称] (Medium)`、`[模型名称] (High)` 或 `[模型名称] (Low)`。
2. 默认选中的模型 ID 支持解析。若默认模型支持思考，默认选中其 `low` 级别（即 `[modelId]:low`）。

### R3: 后端端到端解析与执行

1. `AgentService.getDefaultAgent` 在接收到 `modelId` 时，MUST 检查其是否包含 `:` 后缀。
2. 若包含 `:`（如 `deepseek-v4-pro:medium`），则：
   - 提取 `:` 前的部分作为真实的数据库查询 `modelId`，用以获取模型密钥及配置。
   - 提取 `:` 后面的部分作为 `thinkingLevel` 并赋值给 `agent.state.thinkingLevel`。
3. `automation.service.ts` 中的 `resolveModelId` 同样需要支持解析 `:` 后缀，以防校验失败。

## 验收标准

- [ ] 对于 `reasoning: true` 的模型，模型选择菜单中会展示 `(Medium)`、`(High)`、`(Low)` 三个选项。
- [ ] 选中任意思考程度后，模型选择按钮回显正确的名字与程度，例如 `DeepSeek V4 Pro (Medium)`。
- [ ] 发送消息后，后端解析出对应的思考级别，并在 Agent 执行时正确设置 `agent.state.thinkingLevel`。
- [ ] 默认模型为支持思考的模型时，初始化默认选中其 `low` 级别。
