# 提案：应用 tab 旁边添加刷新按钮

## 动机

当前在右侧边栏的“应用” (App) tab 中，渲染了一个 WebContentsView（AI 应用）。在开发或使用过程中，如果 AI 应用的文件发生改变，或者应用出现卡死/白屏等情况，用户无法方便地对其进行刷新，必须切换工作空间或者重启应用。
在“文件” tab 中已经有一个类似的刷新按钮，因此在“应用” tab 旁边也添加一个刷新按钮，可以极大提升开发和使用体验，并保持界面设计的一致性。

## 目标

1. **刷新按钮 UI**：在右侧边栏“应用” tab 按钮内的“应用”文本右侧，添加一个刷新按钮。
2. **样式一致**：样式风格与“文件” tab 内的刷新按钮保持一致：包含一个 `RotateCw` 图标，在点击或加载时伴随动画。
3. **刷新功能**：点击该按钮时，通过已有的 `electronAPI.loadAiApp` 重新加载当前工作空间的 AI 应用，并重新计算与发送 Bounds。
4. **加载状态**：在重新加载时，旋转刷新图标，防止重复点击。

## 范围

- 右侧边栏组件：[ChatRightSidebar.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue)

## 非范围

- 其他 Tab（如“设置”）的刷新逻辑。
- 改变 `loadAiApp` 的主进程实现。
