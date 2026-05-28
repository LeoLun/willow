# 提案：为所有支持思考的模型提供思考程度选择

## 动机

当前应用内置的模型（如 DeepSeek）以及用户自定义的具有思考能力（reasoning）的模型仅能以默认的思考程度运行。为了提供更具灵活性的大模型控制体验，应当让所有支持思考（`reasoning: true`）的模型在选择时都能选择不同的思考程度（如 Low, Medium, High）。

## 目标

1. 动态生成思考模型选项：对于数据库中任何 `reasoning` 为 `true` 的模型，在模型选择下拉菜单中动态展开为三个选项：
   - `[模型名称] (Low)` (低度思考)
   - `[模型名称] (Medium)` (中度思考)
   - `[模型名称] (High)` (深度思考)
2. 保持非思考模型的选择不变。
3. 采用无损协议传输：在模型选择值中采用 `modelId:thinkingLevel` 的格式（例如 `deepseek-v4-pro:medium`），避免修改数据库 Session/Message 的 schema，实现端到端的思考程度传递。
4. 后端适配：解析包含 `:` 的 `modelId`，提取出实际的 `modelId` 和 `thinkingLevel`，并将 `thinkingLevel` 正确配置到 Agent 实例状态中。

## 范围

- 前端渲染器中 `Sender.vue` 模型下拉菜单的动态展开逻辑及选中状态显示。
- 前端 `SenderContainer.vue` 的 `defaultModelId` 处理（支持带后缀的默认选中解析）。
- 后端 `AgentService` 中的 `getDefaultAgent`，以及 `automation.service.ts` 的模型 ID 解析逻辑，支持解析 `modelId:thinkingLevel` 格式。
- 在 `Agent` 初始化时根据提取出的思考级别动态设置 `agent.state.thinkingLevel`。

## 非范围

- 不修改底层数据库表结构。
- 不限定特定的模型服务商（即不仅限 Gemini 或 DeepSeek，任何 `reasoning: true` 的模型都适用）。
