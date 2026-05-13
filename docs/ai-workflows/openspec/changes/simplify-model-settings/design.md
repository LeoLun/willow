# 设计文档：简化模型设置

## 架构决策

### 1. 内置模型配置

DeepSeek 模型配置硬编码在 `app/work/src/shared/model-config.ts`，作为唯一的内置 provider 配置：

```typescript
export const DEEPSEEK_CONFIG = {
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com",
  api: "openai-completions",
  models: [
    {
      modelId: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      contextWindow: 1000000,
      maxTokens: 384000,
      reasoning: true,
      input: ["text"],
      cost: { input: 1.74, output: 3.48, cacheRead: 0.145, cacheWrite: 0 },
      compat: {
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: "deepseek",
        reasoningEffortMap: { minimal: "high", low: "high", medium: "high", high: "high", xhigh: "max" },
      },
    },
    {
      modelId: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      contextWindow: 1000000,
      maxTokens: 384000,
      reasoning: true,
      input: ["text"],
      cost: { input: 0.14, output: 0.28, cacheRead: 0.028, cacheWrite: 0 },
      compat: { ... },
    },
  ],
};
```

### 2. API Key 管理模式

用户输入一个 API Key，系统将其应用到所有内置 DeepSeek 模型。数据库中每个模型独立存储，但共享同一个 API Key。

- 用户提供 API Key → 系统 upsert 两个内置模型，设置同一个 apiKey
- 用户修改 API Key → 系统更新所有 DeepSeek 模型的 apiKey
- 用户移除 API Key → 系统删除所有 DeepSeek 模型（或清空 apiKey）

### 3. UI 变更

**之前**：配置页面包含"模型配置"区域，每个模型一行，支持添加/编辑/删除/设为默认。

**之后**：配置页面改为"DeepSeek API Key"区域：
- 一个密码输入框 + 保存按钮
- 已配置状态下显示"已配置"状态和两个模型的名称
- 可以修改或清除 API Key
- 不再显示单独的模型列表

移除的对话框：
- `ModelForm.vue`（复杂模型表单）→ 替换为简单的 `DeepSeekApiKeyForm.vue`
- `DeleteModel.vue` → 不再需要

### 4. 数据流

```
用户输入 API Key → IPC addModel/updateModel → ConfigService.upsertBuiltinModels(apiKey)
  → ModelDao.upsert({ modelId: "deepseek-v4-pro", ...内置配置, apiKey })
  → ModelDao.upsert({ modelId: "deepseek-v4-flash", ...内置配置, apiKey })
```

### 5. 与 Agent 集成

`agent.service.ts` 中的 `toAgentModel()` 需要扩展，将 `compat` 和 `cost` 字段也传递给 pi-agent-core。新版本的 pi-agent-core（0.73.x）可能已经支持这些字段。

`resolveApiKey()` 的回退逻辑保留：优先使用数据库中的 apiKey，否则使用环境变量 `DEEPSEEK_API_KEY`。

### 6. 向后兼容

- 数据库中已存在的非 DeepSeek 模型：保留但不在 UI 中显示。Agent 和自动化仍可通过 modelId 引用它们。未来版本可添加迁移清理。
- 已存在的 DeepSeek 模型（modelId 匹配内置列表）：API Key 输入后更新这些模型的内置字段。
