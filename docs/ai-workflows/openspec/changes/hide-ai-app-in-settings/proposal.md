# 提案：在打开设置页面或弹窗时隐藏 AI 应用视图 (WebContentsView)

## 动机

在 Willow 桌面应用中，当用户打开设置页面（Settings）或打开弹窗（Dialog/Modal）时，主应用布局依然保持挂载状态。因为右侧侧边栏组件（`ChatRightSidebar.vue`）并未卸载，且如果其当前处于“应用”标签页（`activeTab === 'app'`）且侧边栏为打开状态，其创建的 native `WebContentsView`（即 AI 应用视图）仍将保持可见。

由于 native `WebContentsView` 在 Electron 中是独立于 DOM 渲染并始终覆盖在 host 窗口之上的，即使设置页面或弹窗在 CSS 中设置了很高的 z-index，AI 应用视图仍会强行显示并覆盖在其上，导致页面或弹窗内容无法正常阅读与交互。

为了提供无缝且正确的用户体验，当设置页面或任意弹窗打开时，应隐藏该 AI 应用视图；在关闭设置页面或弹窗返回主应用时，如果条件满足（处于“应用”标签页且侧边栏处于打开状态），再恢复该 AI 应用视图的显示。

## 目标

1. **设置页面与弹窗检测**：在右侧侧边栏组件（`ChatRightSidebar.vue`）中，能够检测当前路由是否处于设置页面，以及当前是否有弹窗处于打开状态。
2. **条件隐藏**：当用户进入设置页面或打开任何弹窗时，自动隐藏当前显示的 AI 应用视图（WebContentsView），并挂起/注销相关的 resize 监听和位置更新。
3. **关闭后恢复**：当用户退出设置页面或关闭弹窗返回主应用时，若侧边栏仍打开且处于“应用”标签页，则重新显示并更新 AI 应用视图的位置。

## 范围

- 右侧侧边栏组件：`app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`

## 非范围

- 其他 native 窗口或视图的层级逻辑。

