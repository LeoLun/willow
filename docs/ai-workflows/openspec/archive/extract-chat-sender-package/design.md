# Design: extract-chat-sender-package

## Overview

本次设计目标是把 `app/work` 内部聊天发送器沉淀为共享包 `@willow/sender`，同时保留当前桌面工作台式输入器的交互体验。

设计需要同时满足两类约束：

1. 组件边界约束：共享包不得直接依赖 Electron 应用私有实现
2. 产品体验约束：`app/work` 中发送器的现有能力与视觉骨架不能明显回退

根据仓库 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md)，该组件仍应保持“桌面工作台输入器”的紧凑、稳定、工具型观感，而不是演变成风格松散的 demo 组件。

## Current State

当前 [`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue) 同时承担了三层职责：

### 1. 共享 UI 与交互

- Tiptap 编辑器创建与键盘行为
- slash 搜索技能
- 已选技能胶囊展示
- 模型选择菜单
- 联网开关
- token 用量环形展示
- 发送 / 停止按钮

### 2. 应用宿主适配

- 通过 `useConfigStore()` 读取模型列表与默认模型
- 通过 `electronAPI.getAvailableSkills()` 请求技能
- 通过 `useRouter()` 跳转设置页

### 3. 本地实现细节

- 依赖 `@/lib/utils`
- 依赖本地 `CircularProgress.vue`
- 依赖 `@shared/api` 中的应用内类型

这意味着当前组件虽然“能用”，但并没有可抽出的共享包边界。

## Design Principles

### Shared Package First

`@willow/sender` 只承载与宿主无关的内容：

- 视觉结构
- 本地交互状态
- 编辑器生命周期
- 选择器与菜单行为
- 受控 props / emits
- 包级类型导出

### Host Adapter Owns Integration

`app/work` 负责所有宿主相关接入：

- 从 store 读取模型
- 从 IPC 获取技能
- 将“前往设置”映射为路由跳转
- 将发送与停止事件对接到现有消息链路

### Stable Package API

共享包对外暴露的 API 应表达“状态”和“意图”，不暴露 `app/work` 的内部实现细节。

例如对外暴露：

- 当前可选模型列表
- 当前可选技能列表
- 当前是否流式输出
- `send` / `stop` / `open-settings` 等事件

而不是直接要求调用方提供：

- Pinia store 实例
- router 实例
- Electron API 实例

## Package Structure

建议新增：

- `packages/sender/package.json`
- `packages/sender/src/index.ts`
- `packages/sender/src/style.css` 或等价包级样式入口
- `packages/sender/src/components/Sender.vue`
- `packages/sender/src/components/CircularProgress.vue` 或内部等价实现
- `packages/sender/src/types.ts`

如实现阶段发现发送器内部需要再拆子组件，可继续在包内细分，但不应把宿主容器放进 `packages/sender`。

## Public API Design

## Component Export

包入口至少导出：

- `Sender` 组件
- 与 `Sender` props / emits 相关的类型
- 与模型、技能、发送请求相关的共享视图类型

## Sender Props

建议将 `Sender` 设计为以受控数据输入为主的组件，props 至少覆盖：

- `messages`
- `isStreaming`
- `streamMessage`
- `showUsage`
- `models`
- `defaultModelId` 或 `selectedModelId`
- `skills`
- `skillsLoading`
- `skillsErrorMessage`
- `workspaceLabel` 或等价可选上下文展示字段
- `webSearchEnabled` 与其受控更新机制，或保留为包内默认状态并通过事件同步

其中：

- `messages` / `streamMessage` 继续用于 token 使用量估算
- `models` 由宿主传入，包内不直接读取 store
- `skills` 由宿主传入，包内不直接发 IPC 请求

## Sender Emits

组件应通过事件表达用户意图，至少包括：

- `send`
- `stop`
- `open-settings`
- `update:selectedModelId` 或等价事件
- `update:webSearchEnabled` 或等价事件
- 如有必要，可增加 `request-skill-refresh`

`send` 事件建议继续输出结构化 payload，包含：

- `message`
- `selectedSkills`
- `modelId`
- `webSearchEnabled`

这样 `app/work` 可以基本无缝接回现有链路。

## Shared View Types

`@willow/sender` 不应直接导入 `app/work/src/shared/api.ts`，但可以在包内定义宿主无关的等价视图类型，例如：

- `SenderModelOption`
- `SenderSkillOption`
- `SenderUsageMessage`
- `SenderSendPayload`

`app/work` 在适配层中负责把内部类型映射到这些公开类型。

这样做的目的是避免：

- 共享包反向依赖 app
- 包 API 被 Electron 应用私有协议绑死

## State Ownership

建议状态归属如下：

### 包内状态

- 编辑器实例
- 当前草稿文本
- 已选技能
- 手动技能菜单开关
- slash 搜索上下文
- 当前高亮技能项
- 未配置模型提示显示

### 宿主状态

- 可用模型数据源
- 默认模型来源
- 可用技能数据源
- 设置页导航行为
- 消息发送副作用
- 流式停止副作用

### 受控与非受控平衡

为避免宿主接入复杂度过高，建议：

- 草稿文本与技能面板开关仍由包内自行管理
- 模型列表、默认模型、技能列表与 loading/error 状态由宿主传入
- 发送时由包内生成统一 payload，对宿主发出一次 `send`

## Dependency Boundaries

`@willow/sender` 允许依赖：

- `vue`
- `@tiptap/*`
- `@willow/shadcn`
- `lucide-vue-next`
- 轻量工具函数或包内工具模块

`@willow/sender` 不允许直接依赖：

- `app/work` 下任何源码模块
- `@/` 路径别名
- `window.electronAPI`
- `vue-router`
- `pinia`

若某些通用工具确实需要复用，应优先：

1. 在 `packages/sender` 内本地实现
2. 或提升到已有共享包

而不是继续反向引用 `app/work`。

## Styling Strategy

发送器仍要保持当前一体式容器结构：

- 顶部技能胶囊区
- 中部编辑区
- 底部控制条
- 右侧主发送按钮

样式策略建议：

- 组件局部样式继续放在 SFC 内，保证封装性
- 如发送器需要共享基础样式，可在 `packages/sender/src/style.css` 提供包级入口
- 不自建第二套主题 token，继续依赖宿主已提供的 Willow / shadcn token 体系

这意味着：

- `@willow/sender` 的视觉应与 `app/work` 当前主题天然兼容
- 包本身不负责定义全局设计系统，只消费现有 token

## Host Integration In app/work

`app/work` 需要新增一个轻量宿主适配层，建议形式为：

- 保留 `Chat.vue` 中现有发送 / 停止逻辑
- 新建 `SenderContainer.vue` 或等价容器
- 容器内部负责：
  - 从 `useConfigStore()` 读取模型数据
  - 调用 `electronAPI.getAvailableSkills()`
  - 将设置操作映射为 `router.push("/setting")`
  - 把共享包的 `send` / `stop` 事件透传给页面

这样 `Chat.vue` 不必重新吸收发送器内部细节，同时共享包保持纯净。

## Migration Plan

实现迁移建议分三步：

1. 先在 `packages/sender` 中复制并整理现有发送器实现，替换掉所有宿主私有依赖
2. 在 `app/work` 中引入宿主适配容器，把现有 store / IPC / router 数据映射给 `@willow/sender`
3. 替换 `Chat.vue` 的原始导入，完成接线并移除旧本地实现

## Verification Focus

本次实现完成后，需要重点验证：

- `app/work` 中发送器交互是否与迁移前一致
- 模型缺失提示是否仍可触发并进入设置页
- 技能加载、分组、slash 搜索、选择与删除是否正常
- 发送后技能与编辑器清空行为是否保持
- 流式输出时按钮是否正确切换为停止
- 包是否仍然存在对 `app/work` 源码的反向依赖
- `app/ui-playground` 或最小示例环境是否能消费 `@willow/sender`

## Risks And Mitigations

### 风险 1：公共 API 设计过于贴近当前宿主

如果直接把 `app/work` 的内部类型整体暴露给共享包，会让包边界失真。

缓解：

- 包内定义最小公开视图类型
- 由宿主做映射，不让 app 内部类型成为包 API

### 风险 2：发送器内部状态被过度外提

如果把太多局部状态做成受控 props，宿主接入会明显复杂化。

缓解：

- 仅将“数据源”和“副作用入口”交给宿主
- 局部交互状态继续保留在包内

### 风险 3：样式迁移后出现主题断裂

如果发送器依赖了 `app/work` 特有样式上下文，迁移后可能出现视觉回退。

缓解：

- 保持对现有 token 的使用方式
- 不引入包内私有主题变量
- 在 `app/work` 中做迁移后手动验证
