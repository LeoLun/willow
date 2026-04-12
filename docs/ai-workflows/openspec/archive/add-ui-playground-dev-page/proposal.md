# add-ui-playground-dev-page

## Summary

为 `@willow/ui` 新增一个独立的组件测试页面与单独运行的 dev 模式，启动本地 `localhost` Web 服务并直接在浏览器中打开调试，用于脱离 Electron 主应用快速检查消息组件、工具渲染器和基础样式表现，降低 UI 组件开发与视觉校验成本。

## Problem

当前 `@willow/ui` 虽然已经拆成独立 workspace package，但实际调试仍然依赖 `app/work` 的 renderer 构建链路：

- 仓库根 `pnpm dev` 只会启动 `app/work` 的 Electron 开发环境
- `app/work/vite.renderer.config.ts` 通过 alias 直接引用 `packages/ui/src`
- `@willow/ui` 没有独立的 playground、示例页或单独的 dev 启动命令

这会带来几个实际问题：

- 调试单个 UI 组件样式时，需要先进入完整桌面应用上下文，启动成本高
- 组件库开发与业务路由、Electron 容器、主进程依赖耦合过深
- 很难快速构造边界状态，例如长消息、工具调用、折叠内容、空数据和异常样式
- 当只想验证 `@willow/ui` 的视觉回归时，没有一个稳定的独立入口

## Goals

- 为 `@willow/ui` 提供一个可单独启动的 localhost playground / 测试页面
- 让开发者无需启动 Electron 主应用，即可通过浏览器调试 UI 组件样式
- 支持用固定样例数据展示消息组件、工具渲染器和典型交互状态
- 保持 playground 的视觉基线与项目 `DESIGN.md` 和现有样式 token 一致
- 为后续扩展更多组件示例提供稳定入口

## Non-Goals

- 本次不重构 `@willow/ui` 现有组件 API
- 本次不引入 Storybook、Histoire 等重量级文档站方案
- 本次不把 playground 发展成完整组件文档系统
- 本次不替换 `app/work` 中对 `@willow/ui` 的现有集成方式
- 本次不新增与现有设计 token 脱节的视觉体系

## Success Criteria

- 仓库中新增一个专用于 `@willow/ui` 的独立 dev 入口，且可以通过明确命令启动 localhost Web 服务
- 开发者可以在浏览器中直接打开该调试页面，而无需进入 Electron 主应用
- playground 页面能够展示至少一组代表性 UI 场景，用于样式调试与手工验收
- playground 不依赖 Electron 主进程、业务 store 或桌面工作台路由即可运行
- playground 复用 `@willow/ui` 的样式与组件导出，不复制一套平行实现
- 相关约束和任务被完整记录到 OpenSpec change 中，便于后续 `workflow-plan` / `workflow-implement`

## Viable Approaches

### Approach A: 在 `app/work` 内新增隐藏调试路由

在现有 renderer 路由中增加一个内部测试页，通过 `pnpm dev` 启动 Electron 后访问该页面调试组件。

优点：

- 复用现有应用壳、样式和构建配置
- 初期改动量可能较小

缺点：

- 仍然依赖 Electron 启动，无法满足“单独运行 dev 模式”
- 调试成本依旧偏高
- 测试页容易意外依赖业务 store、IPC 或应用上下文

### Approach B: 为 `@willow/ui` 新增独立 localhost playground

在 workspace 中增加一个轻量的 Vite + Vue playground 入口，启动本地 Web 服务，直接在浏览器中访问 `localhost` 调试页面，并消费 `packages/ui/src` 来承载组件样例和样式调试。

优点：

- 最符合“单独运行 dev 模式并直接网页打开调试”的目标
- 与 Electron 主应用解耦，启动更快
- 更容易沉淀固定样例和视觉回归入口

缺点：

- 需要新增一套轻量 dev 入口与脚本
- 需要明确与主应用共享样式基线的方式

### Approach C: 直接引入 Storybook/Histoire

为 `@willow/ui` 建立标准化组件文档站，顺带解决调试与示例展示。

优点：

- 组件隔离和示例管理能力强
- 长期可扩展为文档平台

缺点：

- 明显超出当前需求
- 维护成本和接入复杂度更高
- 对当前仓库来说属于过度设计

## Recommendation

采用 Approach B。当前需求重点是“方便调试各个 UI 组件的样式”，并且已经明确 dev 模式应直接启动 localhost Web 服务，通过浏览器打开调试页。独立 playground 能以最小复杂度满足这个目标，同时避免把调试体验继续绑定在 Electron 主应用上。

## Assumptions

- `@willow/ui` 的主要调试对象是消息渲染相关组件与工具渲染器，而不是整套业务页面
- 后续实现可以接受新增一个轻量 localhost playground 入口或等价的独立 Vite 入口
- playground 默认服务于本地开发与手工验收，不要求生产发布
