# 任务清单
   
## 1. 界面与逻辑迁移
   
- [ ] 1.1 在 `AppearanceSetting.vue` 中添加对 `window.electronAPI.getFloatingBallConfig` 和 `window.electronAPI.setFloatingBallEnabled` 的调用逻辑。
- [ ] 1.2 在 `AppearanceSetting.vue` 模板中添加“悬浮球”设置项，使用 `Switch` 组件，布局和卡片样式与“主题模式”一致。
   
## 2. 路由与菜单清理
   
- [ ] 2.1 从 `Setting.vue` 的 `navItems` 数组中移除“悬浮球”配置。
- [ ] 2.2 在 `router.ts` 中移除 `settingFloatingBall` 路由，并清理 `FloatingBallSetting` 组件的导入。
- [ ] 2.3 删除 `app/work/src/renderer/src/pages/setting/floating-ball/FloatingBallSetting.vue` 文件及整个 `floating-ball` 目录。
   
## 3. 验证与整理
   
- [ ] 3.1 运行代码格式化和静态检查 (`pnpm lint` && `pnpm format`)。
- [ ] 3.2 启动应用进行手动功能测试，验证悬浮球开关状态在重新打开设置页面及重新启动应用时是否能够正确回显和切换。
