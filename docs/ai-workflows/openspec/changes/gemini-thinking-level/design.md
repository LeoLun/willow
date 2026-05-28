# 设计文档：通用思考程度选择支持

## 架构决策

### 1. 数据传输协议 (Data Transport Protocol)

为了不改变已有的数据库模型定义和数据流框架，使用 `modelId:thinkingLevel` 后缀协议在前后端传递。
例如，如果选中的是 `deepseek-v4-pro` 的中度思考级别，则在 IPC 与数据层传递的值为 `deepseek-v4-pro:medium`。

### 2. 渲染进程 UI 适配

在 `packages/sender/src/components/Sender.vue` 中：
- `hasModels` 与 `models` 依旧使用父组件传入的原始模型列表。
- 在 `<template>` 下拉菜单渲染时：
  ```html
  <template v-for="model in models" :key="model.modelId">
    <template v-if="model.reasoning">
      <DropdownMenuItem
        v-for="level in ['medium', 'high', 'low']"
        :key="model.modelId + ':' + level"
        class="gap-2"
        @click="handleModelSelect(model.modelId + ':' + level)"
      >
        <CheckIcon
          class="size-3"
          :class="localSelectedModelId === (model.modelId + ':' + level) ? 'opacity-100' : 'opacity-0'"
        />
        <span>{{ model.name }} ({{ level.charAt(0).toUpperCase() + level.slice(1) }})</span>
      </DropdownMenuItem>
    </template>
    <template v-else>
      <DropdownMenuItem
        class="gap-2"
        @click="handleModelSelect(model.modelId)"
      >
        <CheckIcon
          class="size-3"
          :class="localSelectedModelId === model.modelId ? 'opacity-100' : 'opacity-0'"
        />
        <span>{{ model.name }}</span>
      </DropdownMenuItem>
    </template>
  </template>
  ```

- 修改 `selectedModelName` 计算属性以支持回显后缀：
  ```typescript
  const selectedModelName = computed(() => {
    if (!hasModels.value) return "未配置模型";
    const [baseId, level] = localSelectedModelId.value.split(":");
    const found = props.models.find((model) => model.modelId === baseId);
    if (!found) return localSelectedModelId.value || "选择模型";
    if (level) {
      const levelLabels: Record<string, string> = {
        low: "Low",
        medium: "Medium",
        high: "High",
      };
      return `${found.name} (${levelLabels[level] || level})`;
    }
    return found.name;
  });
  ```

- 修改 `defaultModel` 与 `selectedModel` 计算属性以在本地正常检索匹配 baseId。
- 在 `watch(() => props.defaultModelId)` 和 `watch(() => props.selectedModelId)` 中，若是思考模型且没有后缀，则默认追加 `:low`。

### 3. 主进程与后端逻辑适配

在 `app/work/src/main/service/agent.service.ts`：
- 修改 `getDefaultAgent` 中对 `modelId` 的解析：
  ```typescript
  let dbModel: ModelConfig | undefined;
  let targetThinkingLevel: string | undefined;

  let resolvedModelId = modelId;
  if (resolvedModelId && resolvedModelId.includes(":")) {
    const parts = resolvedModelId.split(":");
    resolvedModelId = parts[0];
    targetThinkingLevel = parts[1];
  }

  if (resolvedModelId) {
    dbModel = this.configService.getModelByModelId(resolvedModelId) ?? undefined;
  }
  ```
- 在 Agent 实例初始化并设置状态时：
  ```typescript
  agent.state.model = resolvedModel as any;
  if (targetThinkingLevel) {
    agent.state.thinkingLevel = targetThinkingLevel as any;
  } else if (resolvedModel.reasoning) {
    agent.state.thinkingLevel = "high"; // 默认 fallback 行为
  }
  ```

在 `app/work/src/main/service/automation.service.ts`：
- 修改 `resolveModelId` 方法：
  ```typescript
  private resolveModelId(modelId: string | null | undefined) {
    if (modelId === undefined || modelId === null) {
      return null;
    }
    const normalized = modelId.trim();
    const baseModelId = normalized.includes(":") ? normalized.split(":")[0] : normalized;
    if (!this.configService.getModelByModelId(baseModelId)) {
      return null; // 或者保留校验逻辑
    }
    return normalized;
  }
  ```
