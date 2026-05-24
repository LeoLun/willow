# 任务列表

## 1. 更新依赖版本
- 将 `pnpm-workspace.yaml` 中 `@mariozechner/pi-ai` 和 `@mariozechner/pi-agent-core` 的 catalog 版本更新为 `^0.73.1`
- 将 `app/work/package.json`、`packages/core/package.json`、`packages/ui/package.json`、`app/ui-playground/package.json` 中的版本同步
- 运行 `pnpm install` 更新 lockfile
- 验证 `pnpm lint` 和 `pnpm type-check`（tsgo --noEmit）通过

## 2. 创建内置模型配置常量
- 在 `app/work/src/shared/` 下新建模型配置文件
- 定义 `BuiltinDeepSeekModels` 数组，包含 pro 和 flash 两个模型的完整配置
- 定义 `DeepSeekProviderConfig` 常量（baseUrl、api）
- 导出辅助函数：`isBuiltinModel(modelId)`、`getBuiltinModelConfig(modelId)`

## 3. 调整配置页面 UI
- 重写 `ConfigurationSetting.vue` 的“模型配置”区域
- 未配置状态下：显示“添加模型”按钮，点击后调用 `openDialog(ModelKeyForm)`
- 已配置状态下：显示“已配置 API Key”状态，以及“修改”和“清除”按钮。点击“修改”调用 `openDialog(ModelKeyForm, { isEdit: true })`

## 4. 实现 ModelKeyForm 弹窗
- 创建 `app/work/src/renderer/src/layout/dialog/model-key-form/ModelKeyForm.vue` 和 `index.ts`
- 实现属性 `isEdit?: boolean`
- 实现根据 `isEdit` 动态决定标题（“新增模型” 或 “修改模型”）
- 实现下拉选择框（目前仅 `deepseek` 一项，且默认选中为 `deepseek`），当 `isEdit` 为 `true` 时禁用下拉框
- 下方实现密码输入框（输入密钥），提示占位符 `sk-...`
- 保存时：如果 API key 为空进行校验阻断。保存成功调用 `setDeepSeekApiKey`，保存后触发状态刷新并调用 `emit('close')` 关闭弹窗

## 5. 调整后端服务
- 修改 `ConfigService`：新增 `upsertBuiltinModels(apiKey)` 方法，使用内置配置 upsert 两个模型
- 简化 `ModelDao`：不再需要复杂的 CRUD，但保留基础查询（getList、getById、getDefault）
- 修改 `toAgentModel()`：传递完整的 cost、compat、input 字段
- 保留 `resolveApiKey()` 的环境变量回退逻辑

## 6. 调整 IPC 控制器
- 保留 `GET_MODEL_LIST`、`SET_DEFAULT_MODEL`
- 简化 `ADD_MODEL` → 改为接收 API Key 并触发内置模型 upsert
- 简化 `UPDATE_MODEL` → 改为仅支持更新 API Key
- 移除 `DELETE_MODEL`（如果不再需要）

## 7. 清理和验证
- 移除未使用的类型定义（`shared/api.ts` 中的旧字段）
- 运行 `pnpm lint`
- 运行 `pnpm type-check`
- 手动测试：输入 API Key → 验证模型出现在发送器中 → 验证 Agent 可正常运行
