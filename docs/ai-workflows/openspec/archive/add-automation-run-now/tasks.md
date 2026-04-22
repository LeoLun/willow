# Tasks: add-automation-run-now

## 1. API 与 IPC

- [x] 1.1 在共享 API 类型中新增 `RunAutomationNowRequest` / `RunAutomationNowResponse`。
- [x] 1.2 在共享 hook 接口中新增 `runAutomationNow(...)`。
- [x] 1.3 新增 `RUN_AUTOMATION_NOW` IPC 常量。
- [x] 1.4 在 preload `electronAPI` 中暴露 `runAutomationNow`，沿用现有自动化 API 错误处理。
- [x] 1.5 新增并注册 `RunAutomationNowController`。

## 2. 主进程执行语义

- [x] 2.1 在 `AutomationService` 中新增 `runAutomationNow(id)` 服务方法。
- [x] 2.2 复用现有自动化执行链路，确保 workspace、model、prompt、session 创建和错误记录一致。
- [x] 2.3 保持同一自动化的并发保护；已有运行时返回可理解错误。
- [x] 2.4 明确手动执行的 `run_kind` 策略，推荐新增 `manual` 并补齐类型、schema 与展示标签。
- [x] 2.5 确保手动执行不影响 cron 注册，也不错误推进漏跑补偿锚点。

## 3. Renderer 状态与详情页

- [x] 3.1 在 `useAutomationStore` 新增 `runAutomationNow(id)` action，并同步更新 list/detail 缓存。
- [x] 3.2 在 `AutomationDetail.vue` 右上角操作区新增“立即执行”按钮。
- [x] 3.3 按钮在自动化未加载、表单有未保存修改、表单无效、保存中或立即执行中时禁用。
- [x] 3.4 点击后展示 loading 文案，成功/失败时用 toast 反馈。
- [x] 3.5 执行成功后刷新最新运行摘要，并保持当前表单状态不被意外覆盖。

## 4. 验证

- [x] 4.1 运行 `pnpm lint`。
- [x] 4.2 运行 `pnpm build`，或说明无法运行的原因。
- [x] 4.3 手动验证详情页立即执行成功路径：按钮短暂 loading、toast、跳转会话、最新运行摘要可追踪。
- [x] 4.4 手动验证未保存修改时不能立即执行。
- [x] 4.5 手动验证已有运行中任务时不会并发启动第二次。
- [x] 4.6 手动验证定时调度仍按原计划工作，立即执行不改变下一次运行注册。

## 5. 启动后跳转会话与刷新列表

- [x] 5.1 调整 `RunAutomationNowResponse`，返回本次执行创建的 `Session`。
- [x] 5.2 调整主进程手动执行流程：创建 session、写入 running run、启动后台发送后立即返回，不等待 AI 完整完成。
- [x] 5.3 保留后台完成/失败后的 `automation_runs` 状态更新与错误记录。
- [x] 5.4 renderer 立即执行成功后刷新该工作空间左侧会话列表。
- [x] 5.5 renderer 立即执行成功后跳转到本次执行会话页。
- [x] 5.6 验证点击后不会卡在自动化详情页“执行中...”状态。
