# 执行计划：简化模型设置

## 概述

7 个执行切片，依赖关系：Slice 1 和 Slice 2 可并行，Slice 3→4→5 串行，Slice 6 与 3-5 并行，Slice 7 最后。

---

## Slice 1: 更新依赖版本

### 1.1 更新 pnpm-workspace.yaml catalog
**文件**: `pnpm-workspace.yaml` (line 11-12)
```diff
- "@mariozechner/pi-ai": ^0.55.3
- "@mariozechner/pi-agent-core": ^0.55.3
+ "@mariozechner/pi-ai": ^0.73.1
+ "@mariozechner/pi-agent-core": ^0.73.1
```

### 1.2 更新直接依赖的 package.json
**文件**: `app/work/package.json` — 将 `@mariozechner/pi-agent-core` 和 `@mariozechner/pi-ai` 版本改为 `catalog:`
**文件**: `packages/core/package.json` — 同上
**文件**: `packages/ui/package.json` — 同上
**文件**: `app/ui-playground/package.json` — 同上

注意：检查这些文件当前是否使用 `^0.62.0` 硬编码还是 `catalog:` 引用，统一改为 `catalog:` 引用。

### 1.3 安装并验证
```bash
cd .worktrees/simplify-model-settings && pnpm install
pnpm lint          # 0 warnings, 0 errors
npx tsgo --noEmit  # 无错误
```

**验收**: lint + type-check 通过，pnpm-lock.yaml 更新。

---

## Slice 2: 创建内置模型配置常量

### 2.1 新建配置文件
**文件**: `app/work/src/shared/model-config.ts`（新建）

```typescript
export interface BuiltinModelDef {
  modelId: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  input: string[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  compat: {
    requiresReasoningContentOnAssistantMessages: boolean;
    thinkingFormat: string;
    reasoningEffortMap: Record<string, string>;
  };
}

export interface BuiltinProviderConfig {
  provider: string;
  baseUrl: string;
  api: string;
  models: BuiltinModelDef[];
}

export const DEEPSEEK_PROVIDER_CONFIG: BuiltinProviderConfig = {
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
      compat: {
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: "deepseek",
        reasoningEffortMap: { minimal: "high", low: "high", medium: "high", high: "high", xhigh: "max" },
      },
    },
  ],
};

export function isBuiltinModel(modelId: string): boolean {
  return DEEPSEEK_PROVIDER_CONFIG.models.some((m) => m.modelId === modelId);
}

export function getBuiltinModelConfig(modelId: string): BuiltinModelDef | undefined {
  return DEEPSEEK_PROVIDER_CONFIG.models.find((m) => m.modelId === modelId);
}
```

**验收**: 文件可被 TypeScript 正确解析，`npx tsgo --noEmit` 无新增错误。

---

## Slice 3: 调整后端服务

### 3.1 ModelDao — 新增 upsert 方法
**文件**: `app/work/src/main/service/dao/model.dao.service.ts`

新增 `upsertByModelId` 方法：按 modelId 查找，存在则更新，不存在则插入。

```typescript
upsertByModelId(data: Omit<ModelInsert, "id" | "createdAt" | "updatedAt">) {
  const existing = this.findByModelId(data.modelId!);
  if (existing) {
    return this.update(existing.id, data);
  }
  return this.insert(data);
}
```

### 3.2 ConfigService — 新增 upsertBuiltinModels
**文件**: `app/work/src/main/service/config.service.ts`

新增方法：
```typescript
import { DEEPSEEK_PROVIDER_CONFIG } from "@shared/model-config";

upsertBuiltinModels(apiKey: string, setDefaultModelId?: string) {
  const results = DEEPSEEK_PROVIDER_CONFIG.models.map((def) => {
    return this.modelDao.upsertByModelId({
      modelId: def.modelId,
      name: def.name,
      provider: DEEPSEEK_PROVIDER_CONFIG.provider,
      baseUrl: DEEPSEEK_PROVIDER_CONFIG.baseUrl,
      api: DEEPSEEK_PROVIDER_CONFIG.api,
      apiKey,
      reasoning: def.reasoning,
      contextWindow: def.contextWindow,
      maxTokens: def.maxTokens,
      isDefault: def.modelId === (setDefaultModelId || "deepseek-v4-flash"),
    });
  });
  return results;
}
```

同时保留 `getModelList()`、`getDefaultModel()`、`setDefaultModel()`。移除 `addModel()`、`updateModel()`、`deleteModel()`。

### 3.3 Context-compression.service.ts — 更新 toAgentModel
**文件**: `app/work/src/main/service/context-compression.service.ts`（line 46-58）

将 `toAgentModel()` 更新为与 agent.service.ts 一致，传递 cost/compat/input。由于两处使用相同的转换逻辑，考虑提取到 `app/work/src/shared/model-config.ts` 作为共享函数。

**验收**: `npx tsgo --noEmit` 无新增错误。

---

## Slice 4: 简化 IPC 层

### 4.1 更新 IPC 常量
**文件**: `app/work/src/shared/constants.ts`

- 新增 `SET_DEEPSEEK_API_KEY = "SET_DEEPSEEK_API_KEY"`
- 保留 `GET_MODEL_LIST`、`SET_DEFAULT_MODEL`
- **考虑移除**: `ADD_MODEL`、`UPDATE_MODEL`、`DELETE_MODEL`（仅当无其他引用时）

### 4.2 更新共享类型
**文件**: `app/work/src/shared/api.ts`

新增：
```typescript
export interface SetDeepSeekApiKeyRequest {
  apiKey: string;
}

export interface SetDeepSeekApiKeyResponse {
  models: ModelConfig[];
}
```

标记以下类型为可选移除（如无外部引用）：`AddModelRequest`、`AddModelResponse`、`UpdateModelRequest`、`UpdateModelResponse`、`DeleteModelRequest`、`DeleteModelResponse`。

### 4.3 新建控制器
**文件**: `app/work/src/main/controllers/config/set.deepseek.api.key.controller.ts`（新建）

```typescript
@Injectable()
export class SetDeepSeekApiKeyController extends IPCBaseController<
  SetDeepSeekApiKeyRequest, SetDeepSeekApiKeyResponse
> {
  @IPC(SET_DEEPSEEK_API_KEY)
  async run(_event, request) {
    if (!request?.apiKey) return this.buildError(400, "apiKey is required");
    const models = this.configService.upsertBuiltinModels(request.apiKey);
    return this.buildResponse({ models });
  }
}
```

### 4.4 移除不需要的控制器
删除文件：
- `app/work/src/main/controllers/config/add.model.controller.ts`
- `app/work/src/main/controllers/config/update.model.controller.ts`
- `app/work/src/main/controllers/config/delete.model.controller.ts`

### 4.5 更新 AppModule
**文件**: `app/work/src/main/app.module.ts`

- 移除 `AddModelController`、`UpdateModelController`、`DeleteModelController` 的 import 和注册
- 新增 `SetDeepSeekApiKeyController` 的 import 和注册

### 4.6 更新 Preload
**文件**: `app/work/src/preload/preload.ts`

- 移除 `addModel`、`updateModel`、`deleteModel` IPC 调用
- 新增 `setDeepSeekApiKey(request: SetDeepSeekApiKeyRequest)` IPC 调用
- 更新 import 类型

### 4.7 更新 Hook 接口
**文件**: `app/work/src/shared/hook/config.hook.ts`

替换类型：
```typescript
export interface IConfigApi {
  getModelList(): Promise<GetModelListResponse>;
  setDeepSeekApiKey(request: SetDeepSeekApiKeyRequest): Promise<SetDeepSeekApiKeyResponse>;
  setDefaultModel(request: SetDefaultModelRequest): Promise<SetDefaultModelResponse>;
  // tavily 不变...
}
```

**验收**: `npx tsgo --noEmit` 无新增错误。导入依赖全部解析。

---

## Slice 5: 简化前端

### 5.1 重写 ConfigurationSetting.vue
**文件**: `app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue`

整个"模型配置"section 替换为"DeepSeek API Key"section：

```vue
<section class="space-y-3">
  <div class="flex items-center justify-between gap-4">
    <div class="space-y-1">
      <h2 class="text-base font-medium">DeepSeek API Key</h2>
      <p class="text-sm text-muted-foreground">
        输入 API Key 后自动配置 DeepSeek V4 Pro 和 Flash 模型
      </p>
    </div>
  </div>

  <!-- 未配置状态 -->
  <div v-if="!hasDeepSeekKey" class="...">
    <Input v-model="apiKey" type="password" placeholder="sk-..." />
    <Button @click="handleSaveKey">保存</Button>
  </div>

  <!-- 已配置状态 -->
  <div v-else class="...">
    <p>已配置 API Key · {{ maskedKey }}</p>
    <p>可用模型：DeepSeek V4 Pro、DeepSeek V4 Flash</p>
    <Button @click="handleChangeKey">修改</Button>
    <Button @click="handleClearKey">清除</Button>
  </div>
</section>
```

关键逻辑：
- `hasDeepSeekKey` 计算属性：检查 modelList 中是否有 modelId 为 `deepseek-v4-pro` 或 `deepseek-v4-flash` 且有 apiKey 的模型
- `handleSaveKey`: 调用 `configStore.setDeepSeekApiKey(apiKey)`
- `handleClearKey`: 弹出确认后调用删除（或设置空 key）—— 根据 R2 需求，清空 key 后模型不可用。实现方式：删除两个内置模型（通过 modelId 查找后删除）。
- 移入 `onBeforeMount`，移除 `ModelForm`、`DeleteModel` 导入

### 5.2 更新 Pinia Store
**文件**: `app/work/src/renderer/src/stores/config.ts`

- 移除 `addModel()`、`updateModel()`、`deleteModel()` actions
- 新增 `setDeepSeekApiKey(apiKey: string)` action
- 保留 `fetchModelList()`、`setDefaultModel()`、`defaultModel` getter

### 5.3 删除不需要的对话框
删除文件：
- `app/work/src/renderer/src/layout/dialog/model-form/ModelForm.vue`
- `app/work/src/renderer/src/layout/dialog/delete-model/DeleteModel.vue`

**验收**: `npx tsgo --noEmit` 无新增错误。Vue 组件解析正常。

---

## Slice 6: 更新 Agent 模型转换

### 6.1 统一 toAgentModel
**文件**: `app/work/src/main/service/agent.service.ts`（line 65-78）

将 `toAgentModel()` 更新为使用 `BuiltinModelDef` 的 cost/compat/input：
```typescript
import { DEEPSEEK_PROVIDER_CONFIG, type BuiltinModelDef } from "@shared/model-config";

function toAgentModel(config: ModelConfig): AgentModel {
  const builtin = DEEPSEEK_PROVIDER_CONFIG.models.find(m => m.modelId === config.modelId);
  return {
    id: config.modelId,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: config.reasoning,
    input: builtin?.input ?? ["text"],
    cost: builtin?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
    ...(builtin?.compat ? { compat: builtin.compat } : {}),
  };
}
```

### 6.2 同步 context-compression.service.ts
**文件**: `app/work/src/main/service/context-compression.service.ts`（line 46-58）

删除重复的 `toAgentModel()` 和 `resolveApiKey()`，改为从 agent.service.ts 导入或使用共享实现。

**验收**: `npx tsgo --noEmit` 无新增错误。Agent 模型包含 compat 字段。

---

## Slice 7: 清理和最终验证

### 7.1 清理 shared/api.ts
移除以下类型定义（如果无其他引用）：
- `AddModelRequest` / `AddModelResponse`
- `UpdateModelRequest` / `UpdateModelResponse`
- `DeleteModelRequest` / `DeleteModelResponse`

### 7.2 清理 shared/constants.ts
移除以下常量（如果无其他引用）：
- `ADD_MODEL`
- `UPDATE_MODEL`
- `DELETE_MODEL`

### 7.3 最终验证
```bash
pnpm lint          # 0 warnings, 0 errors
npx tsgo --noEmit  # 无错误
```

### 7.4 手动测试清单
- [ ] 启动应用，进入设置 → 配置
- [ ] 看到 DeepSeek API Key 输入框（无模型列表）
- [ ] 输入有效 API Key，保存
- [ ] 发送器中可选 deepseek-v4-pro 和 deepseek-v4-flash
- [ ] deepseek-v4-flash 为默认模型
- [ ] 修改 API Key 后两个模型同步更新
- [ ] 清除 API Key 后模型不可用（发送器无模型可选）
- [ ] Agent 发送消息功能正常，推理模式正确

---

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `pnpm-workspace.yaml` |
| 修改 | `app/work/package.json` |
| 修改 | `packages/core/package.json` |
| 修改 | `packages/ui/package.json` |
| 修改 | `app/ui-playground/package.json` |
| 新建 | `app/work/src/shared/model-config.ts` |
| 修改 | `app/work/src/main/service/dao/model.dao.service.ts` |
| 修改 | `app/work/src/main/service/config.service.ts` |
| 修改 | `app/work/src/main/service/agent.service.ts` |
| 修改 | `app/work/src/main/service/context-compression.service.ts` |
| 修改 | `app/work/src/shared/constants.ts` |
| 修改 | `app/work/src/shared/api.ts` |
| 修改 | `app/work/src/shared/hook/config.hook.ts` |
| 新建 | `app/work/src/main/controllers/config/set.deepseek.api.key.controller.ts` |
| 删除 | `app/work/src/main/controllers/config/add.model.controller.ts` |
| 删除 | `app/work/src/main/controllers/config/update.model.controller.ts` |
| 删除 | `app/work/src/main/controllers/config/delete.model.controller.ts` |
| 修改 | `app/work/src/main/app.module.ts` |
| 修改 | `app/work/src/preload/preload.ts` |
| 修改 | `app/work/src/renderer/src/stores/config.ts` |
| 修改 | `app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue` |
| 删除 | `app/work/src/renderer/src/layout/dialog/model-form/ModelForm.vue` |
| 删除 | `app/work/src/renderer/src/layout/dialog/delete-model/DeleteModel.vue` |
