# 任务列表

## 1. 修改前端组件支持动态思考程度展示
- [ ] 修改 `packages/sender/src/components/Sender.vue`：
  - 更新 `models` 下拉菜单渲染逻辑，若 `model.reasoning` 为 `true`，则展开展示 `medium`、`high`、`low` 三个子选项，并对应传递 `modelId:level`。
  - 修改 `selectedModelName` 计算属性，支持展示 `[模型名称] ([思考程度名称])` 的格式。
  - 更新 `defaultModel` 与 `selectedModel` 计算属性以解析 `modelId` 里的 `:` 后缀。
  - 调整 `watch` 监听器，在默认模型包含 `reasoning: true` 时，为其初始化带上 `:low` 后缀。

## 2. 修改主进程模型解析
- [ ] 修改 `app/work/src/main/service/agent.service.ts`：
  - 在 `getDefaultAgent` 中，检测传入的 `modelId` 是否包含 `:` 后缀。
  - 若包含后缀，拆分出真实的数据库查询 ID 以及目标 `thinkingLevel`，利用真实 ID 查找配置。
  - 将解析到的 `thinkingLevel` 传递设置给 `agent.state.thinkingLevel`。
- [ ] 修改 `app/work/src/main/service/automation.service.ts`：
  - 在 `resolveModelId` 中，剥离模型 ID 的 `:` 后缀进行数据库存在性检查。

## 3. 验证与清理
- [ ] 运行 `pnpm lint`。
- [ ] 运行 `pnpm build`。
- [ ] 测试内置的 DeepSeek 思考模型，输入 API Key 后检查下拉菜单中是否正常展开展示 `Low`、`Medium`、`High` 选项。
