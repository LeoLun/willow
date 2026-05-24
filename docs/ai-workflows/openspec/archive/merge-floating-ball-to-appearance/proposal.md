# 合并悬浮球设置到外观配置
   
## 动机
   
当前设置页面中，“悬浮球”设置作为一个独立的 Tab 存在。由于悬浮球设置极其简单（仅包含一个“开启悬浮球”的开关），单独占用一个 Tab 显得多余，用户体验不够紧凑。将其合并到“外观”配置页面中，可以简化设置菜单，使整体设置结构更清晰、更聚焦。
   
## 目标
   
1. 将悬浮球的“开启悬浮球”设置项合并到“外观”设置页面中，保持与“外观”页面中其他设置项（如主题模式）风格一致。
2. 从设置侧边栏中移除“悬浮球”导航项。
3. 从路由中删除 `/setting/floating-ball` 路由及对应的页面组件。
   
## 范围
   
- 修改 `app/work/src/renderer/src/pages/setting/appearance/AppearanceSetting.vue`：
  - 引入悬浮球配置的获取与更新 API 逻辑。
  - 在“外观”页面中添加“悬浮球”开关设置项。
- 修改 `app/work/src/renderer/src/pages/setting/Setting.vue`：
  - 移除 `navItems` 中对应的“悬浮球”菜单项。
- 修改 `app/work/src/renderer/src/router.ts`：
  - 移除 `settingFloatingBall` 路由定义。
- 删除 `app/work/src/renderer/src/pages/setting/floating-ball/FloatingBallSetting.vue`。
   
## 非范围
   
- 不修改悬浮球本身的 IPC 接口或主进程服务逻辑。
- 不影响悬浮球的其他功能表现。
