# 模型配置规范

## 需求

### R1: 内置 DeepSeek 模型配置

系统 MUST 内置 DeepSeek V4 Pro 和 DeepSeek V4 Flash 两个模型的完整配置，包含：
- provider: "deepseek"
- baseUrl: "https://api.deepseek.com"
- api: "openai-completions"
- contextWindow: 1000000
- maxTokens: 384000
- reasoning: true
- cost 信息
- compat 信息（thinkingFormat: "deepseek", reasoningEffortMap）

### R2: API Key 输入

设置页面 MUST 提供 DeepSeek API Key 输入框，用户只需输入密钥即可激活内置模型。

输入框行为：
- 密码类型输入（不显示明文）
- 保存后自动 upsert 两个内置模型到数据库，使用相同的 apiKey
- 修改 API Key 后，更新所有内置模型的 apiKey

### R3: 默认模型

两个内置模型 MUST 默认为可用状态。deepseek-v4-flash 应设为默认模型（成本低，适合日常使用）。

### R4: 移除复杂模型表单

MUST 移除以下 UI 元素：
- ModelForm.vue 对话框（包含所有模型字段的表单）
- DeleteModel.vue 对话框
- 配置页面中的模型列表

MUST 移除以下 IPC 接口（如果不再被其他地方使用）：
- DELETE_MODEL
- 模型编辑功能（UPDATE_MODEL 可简化为仅更新 API Key）

### R5: 依赖更新

MUST 将 `@mariozechner/pi-ai` 和 `@mariozechner/pi-agent-core` 更新到 `^0.73.1`，同步更新 pnpm-workspace.yaml catalog。

### R6: Agent 模型转换

`toAgentModel()` 函数 MUST 传递完整的模型配置（包括 cost、compat、input 字段）给 pi-agent-core，以利用新版本的模型兼容性特性。

## 验收标准

- [ ] 设置页面显示"DeepSeek API Key"输入框，而非模型列表
- [ ] 输入 API Key 后，发送器中可选 deepseek-v4-pro 和 deepseek-v4-flash
- [ ] deepseek-v4-flash 为默认模型
- [ ] 修改 API Key 后两个模型同步更新
- [ ] 清空 API Key 后模型不可用
- [ ] pi-ai 和 pi-agent-core 为 0.73.1
- [ ] Agent 正常运行，推理模式正确配置
