# extract-chat-sender-package

## Summary

将当前仅存在于 `app/work` renderer 内部的聊天发送器组件 [`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue) 抽离为独立的 workspace npm 包 `@willow/sender`，使其成为可复用、可单独发布、由宿主应用注入业务依赖的通用聊天发送器。

这次变更不是简单“挪文件”，而是要把现有组件中的宿主耦合拆出来，包括：

- Electron IPC 能力
- Vue Router 导航
- Pinia store 中的模型列表与默认模型
- `app/work` 本地组件依赖，如 `CircularProgress`
- `@shared/api` 中只适用于 Electron 应用内部的类型约束

最终目标是让 `app/work` 继续使用几乎等价的发送器体验，同时把组件沉淀为一个清晰的共享包边界，后续可供 `app/ui-playground` 或其他宿主复用。

## Problem

当前 `Sender` 组件虽然只有一个直接使用点，但承担了过多宿主职责：

- 直接读取 `useConfigStore()` 获取模型列表和默认模型
- 直接使用 `electronAPI.getAvailableSkills()` 拉取技能
- 直接使用 `useRouter()` 跳转设置页
- 直接依赖 `@shared/api` 的应用内消息类型
- 直接依赖本地 `CircularProgress.vue`

这导致几个问题：

- 组件无法在 `packages/` 中作为独立包复用
- UI 结构、交互逻辑、业务接入逻辑混在一起，演进成本高
- 后续若想在 `ui-playground` 或其他宿主验证发送器，需要复制实现而不是直接复用
- 包发布边界不清晰，容易把 Electron 私有能力意外泄漏进共享层

## Goals

- 新建独立 workspace 包 `@willow/sender`
- 将当前发送器的视觉骨架、编辑器行为、技能选择交互和发送交互沉淀到该包
- 明确宿主注入接口，使模型数据、技能数据、设置跳转和发送行为由宿主传入
- 保持 `app/work` 中当前发送器的主要用户体验不回退
- 为后续在 `app/ui-playground` 或其他宿主中复用发送器预留稳定接入方式

## Non-Goals

- 本次不重做发送器视觉风格
- 本次不改动现有技能协议、消息发送协议或主进程技能发现协议
- 本次不把整个聊天页都抽到共享包，只聚焦发送器及其必要的内部子模块
- 本次不强制引入新的状态管理方案
- 本次不要求把 `CircularProgress` 单独设计成完整通用图形组件库

## Success Criteria

- `packages/` 下新增 `@willow/sender` 包，并具备清晰的 `package.json` 与导出入口
- `app/work` 改为消费 `@willow/sender`，而不是继续直接引用本地 `sender/index.vue`
- `@willow/sender` 不再直接依赖 Electron IPC、Pinia store、Vue Router 或 `@/` 别名模块
- 包对外暴露稳定的 props / emits / 类型导出，用于宿主传入模型、技能、状态与行为
- 现有发送器支持的核心能力保持可用：
  - 文本编辑
  - 发送 / 停止
  - 模型选择
  - 联网开关
  - 技能选择与 slash 搜索
  - token 用量展示
- `app/work` 中仅保留轻量宿主适配层，用于对接 store、IPC 和路由

## Viable Approaches

### Approach A: 直接把现有 `index.vue` 搬到 `packages/sender`，保留大部分依赖

优点：

- 改动路径最短
- 可以较快完成文件层面的“迁移”

缺点：

- 共享包会继续耦合 Electron 应用内部实现
- 难以在其他宿主中复用
- 会把 `@/` 别名、store、router、IPC 这些本地约束带进共享层

### Approach B: 把发送器拆成“共享展示组件 + app/work 宿主容器”

即在 `@willow/sender` 中保留纯 UI 与交互状态机，由 `app/work` 容器负责：

- 拉取模型数据
- 拉取技能数据
- 跳转设置页
- 接收 `send` / `stop` 事件并对接现有链路

优点：

- 包边界清晰，复用价值最高
- `app/work` 仍能保留现有业务接入方式
- 后续更容易做 playground、文档或其他宿主适配

缺点：

- 需要重新设计输入 props、事件和类型导出
- 需要识别哪些状态应该下沉到包内，哪些保留在宿主

### Approach C: 只抽离 editor 与技能选择子模块，外层发送器仍留在 `app/work`

优点：

- 风险较低
- 只拆最重的局部逻辑

缺点：

- 用户请求的“拆分到独立 npm 包”完成度不足
- 最外层发送器仍然无法被其他宿主复用
- 以后仍会留下二次拆分成本

## Recommendation

采用 Approach B。

它最符合“独立 npm 包”的真实目标：共享层负责稳定 UI 和交互，宿主层负责业务依赖注入。这样既不会把 Electron 私有能力带进 `packages/`，也能让 `app/work` 迁移成本保持在可控范围内。

## Next Step

进入 `workflow-worktree` 准备隔离实现环境，然后在 `workflow-plan` 中明确：

- `@willow/sender` 的公共 API
- `app/work` 的宿主适配层职责
- 包导出、样式与依赖治理方案
