# 合并悬浮球设置至外观配置 执行计划
   
## 目标
   
将“悬浮球”开关合并到“外观”设置页面中，并移除多余的悬浮球 Tab 及路由。
   
## 提出变更
   
1. **渲染层更新**：
   - `app/work/src/renderer/src/pages/setting/appearance/AppearanceSetting.vue` -> 添加开关逻辑及 UI 表单卡片。
   - `app/work/src/renderer/src/pages/setting/Setting.vue` -> 移除侧边栏中的菜单项。
   - `app/work/src/renderer/src/router.ts` -> 移除路由和组件引用。
   - 删除 `app/work/src/renderer/src/pages/setting/floating-ball/FloatingBallSetting.vue` 文件及父目录。
   
## 验证计划
   
1. **静态检查与编译**：
   - 运行 `pnpm lint` 校验有无类型和语法错误。
   - 运行 `pnpm build` 确认项目可以正常构建。
2. **手动验证**：
   - 运行 `pnpm dev` 启动应用。
   - 进入“设置” -> “外观”页面，检查是否能正常显示“主题模式”和“悬浮球”开关。
   - 确认侧边栏中不再包含“悬浮球”选项。
   - 点击“悬浮球”开关，验证桌面上悬浮球的显示/隐藏状态是否即时变化，且重新打开设置页面时开关状态能够正确保持。
