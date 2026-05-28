# 执行计划：思考模型支持选择思考程度

## 概述

本计划包含三个执行分片（Slices），依赖关系为：Slice 1 与 Slice 2 并行，Slice 3 依赖于 Slice 1 和 Slice 2 完工后进行。

---

## Slice 1: 前端组件支持动态思考程度展示

### 1.1 修改 `Sender.vue`
**文件**: `packages/sender/src/components/Sender.vue`
- 在模型选择下拉菜单遍历 `models` 时，通过 `v-if="model.reasoning"` 区分思考模型。
- 如果模型支持思考（`reasoning: true`），动态循环渲染 `['medium', 'high', 'low']` 三个子选项，点击时触发 `handleModelSelect(model.modelId + ':' + level)`。
- 修改 `selectedModelName` 计算属性，截断并提取 `modelId` 中的 `:` 后缀，回显格式为：`[模型名称] ([思考程度标签])`，例如：`DeepSeek V4 Pro (Medium)`。
- 修改 `selectedModel` 与 `defaultModel` 计算属性，支持剥离 `:` 后缀以在 `props.models` 数组中查找到对应的原始模型定义。
- 调整对 `selectedModelId` / `defaultModelId` 的 `watch` 监听器。如果模型支持思考且在传入时没有携带后缀（例如刚配置好初始数据或在设置中重置了默认模型），默认追加 `:low` 作为初始选中值。

### 1.2 校验前端状态
- 运行 `pnpm lint` 验证前端代码规范。
- 使用 `pnpm dev:ui` 或在 `app/ui-playground` 中预览，确保组件结构及渲染正确无误。

---

## Slice 2: 后端与主进程模型解析逻辑适配

### 2.1 修改 `AgentService` 中的 `getDefaultAgent`
**文件**: `app/work/src/main/service/agent.service.ts`
- 修改 `modelId` 解析逻辑：若包含 `:`，则拆分为真实的 `resolvedModelId` 和 `targetThinkingLevel`。
- 使用 `resolvedModelId` 查询数据库中的配置，读取 API Key。
- 初始化 `Agent` 后，如果解析到了 `targetThinkingLevel`，则赋值给 `agent.state.thinkingLevel`。若未解析到，但模型配置支持推理，默认 fallback 到 `high`。

### 2.2 修改 `AutomationService` 的 `resolveModelId`
**文件**: `app/work/src/main/service/automation.service.ts`
- 在校验外部输入的 `modelId` 是否存在于数据库时，若输入值中包含 `:`，先使用 `split(":")[0]` 截断取出 baseId 再调用数据库检索。

---

## Slice 3: 清理与集成测试验证

### 3.1 代码规范校验与编译测试
- 在工作空间根目录下运行：
  ```bash
  pnpm lint
  pnpm build
  ```
  确保没有任何 oxlint 报错或 TypeScript 编译错误。

### 3.2 手动集成测试
- 运行 `pnpm dev` 启动 Electron 桌面应用程序。
- 进入设置页面，输入 DeepSeek API Key 激活内置的 DeepSeek 思考模型。
- 返回聊天主界面，点击输入框下方的模型选择菜单，确认下拉列表自动展开为了带有 `(Low)`、`(Medium)`、`(High)` 后缀的三个选项。
- 切换不同的选项，观察回显名字是否更新。
- 发起一条消息测试，观察后端日志或控制台确认 Agent 运行时 `thinkingLevel` 是否正确加载并使用该配置发起请求。

---

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `packages/sender/src/components/Sender.vue` |
| 修改 | `app/work/src/main/service/agent.service.ts` |
| 修改 | `app/work/src/main/service/automation.service.ts` |
