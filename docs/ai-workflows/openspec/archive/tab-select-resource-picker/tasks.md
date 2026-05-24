# 任务清单
   
## 1. 键盘事件拦截与选择逻辑
   
- [ ] 1.1 在 `packages/sender/src/components/Sender.vue` 中的 `handleEditorKeyDown` 函数中，为 `Tab` 按键增加 `case "Tab"` 分支。
- [ ] 1.2 在 `Tab` 按键触发时：
  - 调用 `event.preventDefault()` 阻止默认的 Tab 键聚焦切换。
  - 获取当前选中的资源项并调用 `handleResourceSelect` 进行确认插入。
  - 返回 `true` 以终止事件继续传播。
   
## 2. 验证与测试
   
- [ ] 2.1 运行编译与格式化校验（`pnpm lint && pnpm format`）。
- [ ] 2.2 在应用中验证 `/` 面板呼出后，按 `Tab` 是否能成功选中高亮项。
