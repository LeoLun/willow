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

### R2: 弹窗管理 API Key (新增/修改模型)

设置页面不再直接提供内联的 API Key 输入框，而是通过弹窗 (ModelKeyForm) 进行 API Key 密钥的添加与修改。

弹窗规格要求：
1. **弹窗标题**：
   - 新增状态下显示为：`新增模型`
   - 修改状态下显示为：`修改模型`
2. **模型选择**：
   - 在模型下拉框中显示模型选项，目前仅有 `deepseek` 选项，且默认选中为 `deepseek`。
   - **新增时**：支持下拉选择模型。
   - **修改时**：无法下拉选择模型（下拉框处于 disabled 禁用状态）。
3. **添加密钥**：
   - 模型选择下方显示密钥输入框，类型为密码类型（不显示明文），提供占位符 `sk-...`。
4. **提交行为**：
   - 用户点击确定/保存后，如果密钥为空，进行验证拦截。
   - 保存时自动通过 `setDeepSeekApiKey` 将密钥应用到内置模型，保存成功后关闭弹窗并刷新状态。

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

- [ ] 设置页面在未配置 API Key 时，显示“添加模型”按钮；点击后弹出“新增模型”弹窗
- [ ] 弹窗在新增状态下，标题为“新增模型”，包含“模型”下拉菜单且只能选择 `deepseek`，默认选中 `deepseek`
- [ ] 弹窗中“模型”下拉菜单下方包含“密钥”输入框，支持密码隐藏显示
- [ ] 新增成功后，设置页面更新为“已配置 API Key”状态，显示“修改”和“清除”按钮
- [ ] 点击“修改”按钮后，弹出“修改模型”弹窗，标题为“修改模型”，其“模型”下拉菜单被禁用（不可下拉选择），且可以修改密钥
- [ ] 输入 API Key 后，发送器中可选 deepseek-v4-pro 和 deepseek-v4-flash
- [ ] deepseek-v4-flash 为默认模型
- [ ] 修改 API Key 后两个模型同步更新
- [ ] 清空/清除 API Key 后模型不可用
- [ ] pi-ai 和 pi-agent-core 为 0.73.1
- [ ] Agent 正常运行，推理模式正确配置
