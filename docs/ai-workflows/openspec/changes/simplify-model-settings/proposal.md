# 简化模型设置

## 动机

当前模型设置页面允许用户手动填写所有模型配置字段（provider、modelId、baseUrl、api、apiKey、contextWindow、maxTokens、reasoning），操作繁琐且容易出错。用户只需使用 DeepSeek 模型，输入 API Key 即可开始使用。同时 `@mariozechner/pi-ai` 和 `@mariozechner/pi-agent-core` 需要更新到最新版以获取最新的模型兼容性支持。

## 目标

1. 将 `@mariozechner/pi-ai` 和 `@mariozechner/pi-agent-core` 从 `^0.62.0` 更新到 `^0.73.1`
2. 简化模型配置流程：用户只需输入 DeepSeek API Key，系统自动创建 deepseek-v4-pro 和 deepseek-v4-flash 两个模型
3. 模型参数（contextWindow、maxTokens、reasoning、cost、compat 等）内置到代码中，无需用户手动配置
4. 移除复杂的模型表单，替换为简洁的 API Key 输入

## 范围

- 更新 pi-ai 和 pi-agent-core 依赖版本
- 新增 DeepSeek 模型配置常量
- 简化设置页面的模型配置 UI，API Key 密钥管理改为弹窗进行添加或修改
- 移除旧版复杂的 ModelForm，新建用于添加/修改 API Key 密钥的弹窗组件 (ModelKeyForm)
- 调整 ConfigService / ModelDao 逻辑以支持自动创建内置模型
- 移除不必要的模型管理操作（编辑模型详情、删除单个模型）
- 数据库 schema 可能保持不变，但 API 层面简化

## 非范围

- 不添加其他 AI 提供商支持
- 不改变 Tavily API Key 管理方式
- 不影响自动化系统中的模型选择逻辑
