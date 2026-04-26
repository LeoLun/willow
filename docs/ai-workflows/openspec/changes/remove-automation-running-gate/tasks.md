# Tasks: remove-automation-running-gate

## 1. 执行门禁调整

- [x] 1.1 移除 `AutomationService.runAutomationNow(...)` 中基于 `automationRunDao.findRunningByAutomationId(...)` 的拒绝逻辑。
- [x] 1.2 移除 `AutomationService.executeAutomationRun(...)` 中基于数据库 running 记录的跳过/拒绝逻辑。
- [x] 1.3 保留或调整 `runningAutomationIds`，确保它只作为当前进程内短生命周期保护，并在成功、失败、启动异常后释放。
- [x] 1.4 确认历史 `automation_runs.status = "running"` 记录不会阻止 manual、scheduled、catch_up 任一路径。

## 2. DAO 与类型清理

- [x] 2.1 如果 `AutomationRunDao.findRunningByAutomationId(...)` 不再有执行入口依赖，删除该方法；否则补充注释说明它不得作为跨进程门禁。
- [x] 2.2 检查共享 API 与 renderer 展示逻辑，确认 `AutomationRunStatus = "running"` 仅表示展示状态，不参与启动权限判断。
- [x] 2.3 不新增迁移，除非实现阶段发现必须改变运行状态枚举或表结构。

## 3. Renderer 行为确认

- [x] 3.1 确认自动化详情页“立即执行”按钮禁用条件不依赖 `latestRun.status === "running"`。
- [x] 3.2 保留点击请求期间的本地 loading/disabled 防重复交互。
- [x] 3.3 失败 toast 不再把历史数据库 running 残留误报为不可恢复状态。

## 4. 验证

- [x] 4.1 运行 `pnpm lint`。
- [x] 4.2 运行 `pnpm build`，或记录无法运行的原因。
- [ ] 4.3 手动或通过脚本制造一条历史 `automation_runs.status = "running"` 记录，验证立即执行可启动新会话。
- [ ] 4.4 验证自动化执行过程中停止应用后，重新打开应用可以再次执行同一自动化。
- [ ] 4.5 验证定时执行和 catch-up 不因历史 running 记录跳过。
- [ ] 4.6 验证正常完成与失败仍会更新本次运行记录状态。
