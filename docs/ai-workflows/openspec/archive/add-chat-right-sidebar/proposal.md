# add-chat-right-sidebar

## Summary

为聊天页 [`Chat.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/Chat.vue) 增加右侧边栏能力，并支持在右上角折叠 / 展开。右侧边栏根据当前上下文展示不同内容：

- `workspace` 路由下展示工作空间设置，信息编排参考 [`workspace-right-sidebar.tsx`](/Users/liujinglun/code/willow/docs/ui-design/workspace-right-sidebar.tsx)
- `session` 路由下展示当前会话信息，包含概要与文件两个标签页，信息编排参考 [`chat-right-sidebar.tsx`](/Users/liujinglun/code/willow/docs/ui-design/chat-right-sidebar.tsx)
- 当前悬浮在输入框上方的 `TODO` 进度展示迁移到 `session` 右侧栏的“概要”下面
- “文件”标签展示当前工作空间的文件列表，而不是当前会话临时附加文件

## Problem

当前聊天页只有主内容区和底部输入区，没有稳定的右侧辅助信息区，导致以下问题：

- `workspace` 与 `session` 两类上下文都缺少与主内容同屏的辅助信息承载区域
- `TODO` 进度当前悬浮在输入区上方，位置偏临时，和会话元信息割裂
- 工作空间设置和会话概览没有统一入口，用户需要在脑中切换上下文
- 设计稿中已经提供了右侧栏方向，但现有页面壳层还没有承接这类双栏结构

## Goals

- 为聊天页建立统一的“主内容区 + 可折叠右侧栏”布局
- 在右上角提供稳定的折叠 / 展开入口
- 在 `workspace` 路由下展示工作空间设置型右栏
- 在 `session` 路由下展示会话概览与工作空间文件列表型右栏
- 将 `TODO` 工具展示迁移到会话概览区，并保持与会话状态同步
- 为后续实现明确新增的数据读取能力边界，例如工作空间文件列表

## Non-Goals

- 本次不重做左侧导航或整体聊天页路由结构
- 本次不引入新的视觉主题、品牌色或偏营销化布局
- 本次不要求一次性扩展完整文件预览、文件搜索或文件编辑能力
- 本次不强制把工作空间设置扩展成完整设置中心；只覆盖本次右侧栏所需内容

## Success Criteria

- `Chat.vue` 所在聊天壳层支持右侧栏展开与折叠，折叠按钮位于页面右上角
- `workspace` 与 `session` 两种上下文下的右侧栏内容差异被明确约束
- `session` 右侧栏包含“概要”和“文件”两个主标签，且 `TODO` 展示迁移到“概要”下方
- “文件”标签的数据来源明确为当前工作空间文件列表
- 新增 OpenSpec 变更包含 `proposal.md`、`design.md`、`tasks.md`、`specs/chat-right-sidebar/spec.md`

## Viable Approaches

### Approach A: 在 `Chat.vue` 中统一承载右侧栏，并按当前子路由切换内容

把右侧栏作为聊天页壳层的一部分，由 `Chat.vue` 统一管理折叠状态、右上角入口和布局宽度，再由当前路由决定具体渲染 `workspace` 设置面板还是 `session` 信息面板。

优点：

- 折叠状态与页面骨架集中管理，最符合“聊天页右上角”入口要求
- `workspace` / `session` 可以共享一致的右栏宽度、动画与留白规则
- 更容易把输入区、消息区、标题区和右栏做整体响应式协调

缺点：

- 需要为路由子页增加面板数据透传或共享状态
- 壳层职责会变多，需要明确边界

### Approach B: 让 `Workspace.vue` 和 `Session.vue` 各自内嵌右侧栏

两个子路由页面分别实现自己的右侧栏与折叠逻辑，`Chat.vue` 仅负责底部输入区。

优点：

- 子页可独立开发，初期改动看似局部
- 每个子页可以自由组织自己的次级布局

缺点：

- 右上角入口位置难统一，容易出现两个页面行为不一致
- 折叠状态和内容区宽度规则会重复实现
- 不利于后续沉淀成统一聊天页壳层

### Approach C: 保留当前页面结构，只增加浮层式抽屉右栏

不改聊天页主布局，点击按钮后从右侧拉出抽屉或临时面板。

优点：

- 对当前布局侵入最小
- 初期实现速度可能更快

缺点：

- 不符合设计稿中稳定右栏的工作台语义
- `TODO`、文件树、设置表单这类持续辅助信息不适合做成临时浮层
- 与 `DESIGN.md` 强调的稳定双区结构不一致

## Recommendation

采用 Approach A。在 `Chat.vue` 建立统一右侧栏壳层，再根据当前是 `workspace` 还是 `session` 子路由切换右栏内容。这样最能保证折叠入口位置稳定、信息层级一致，也最符合仓库 `DESIGN.md` 的桌面工作台风格。

## Next Step

进入 `workflow-plan`，基于本变更补充实现计划与验证步骤。
