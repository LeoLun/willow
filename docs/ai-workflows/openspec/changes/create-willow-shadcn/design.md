# Design

## Scope

本次设计覆盖：

- `@willow/shadcn` 的包职责定义
- 共享基础组件的目录组织与导出边界
- `@willow/shadcn`、`@willow/ui` 与 `app/work` 本地组件目录之间的职责划分
- 现有 `app/work/src/renderer/src/components/ui/` 向共享包迁移的规则

本次不覆盖：

- 具体组件代码迁移实现
- 业务页面的完整 import 批量替换
- 新视觉风格、新 token 或 `DESIGN.md` 的重写
- `@willow/ui` 上层渲染器与消息组件的产品行为调整

## Current State

当前仓库呈现两个层次混合的状态：

1. `app/work/src/renderer/src/components/ui/`
   - 已经包含大量 `shadcn-vue` 基础组件与扩展组件
   - 是 `app/work` renderer 的主要基础组件来源
2. `packages/ui`
   - 包名为 `@willow/ui`
   - 当前主要承载消息列表、Markdown、工具渲染器、聊天消息容器等上层 UI 组件
   - 仅有少量基础组件示例，并不是完整 shadcn 基础组件库

这说明当前真正的基础组件真相源仍然留在应用内部，而共享包承担的是更高层表达能力。

## Design Principles

### Principle: 基础组件与上层组件分层

`@willow/shadcn` 只承载全仓共享的基础 UI primitives 与配套工具。

包括但不限于：

- `Button`、`Input`、`Dialog`、`Card` 等典型 shadcn 组件
- 与这些组件同层的 `index.ts` 导出文件
- 必要的基础工具函数、样式依赖说明和组件内局部依赖

不包括：

- 消息流容器
- Markdown 渲染组件
- Tool renderer
- 面向产品域的组合型业务组件

### Principle: `@willow/ui` 继续保留上层展示语义

`@willow/ui` 应继续专注于：

- 聊天消息与会话展示
- 富文本、Markdown、代码块等内容渲染
- tool output 的渲染器与工厂
- 针对 Willow 产品语义封装的组合型组件

这样可以避免“基础组件库”和“产品组件库”语义混杂。

### Principle: `app/work` 不再作为共享组件真相源

实施完成后，`app/work/src/renderer/src/components/ui/` 不应继续作为新增共享基础组件的首选落点。

允许的过渡方式：

- 短期内保留兼容 re-export 或本地包装层
- 新增共享基础组件优先落到 `@willow/shadcn`
- 页面与业务组件逐步改为从 workspace 包消费

## Package Architecture

推荐结构如下：

```text
packages/
  shadcn/
    package.json
    src/
      components/
        ui/
          button/
          card/
          dialog/
          ...
      lib/
      index.ts
      style.css
```

设计约束：

- `@willow/shadcn` 的公开入口必须稳定、可预测
- 基础组件按组件名目录分组，延续现有 `shadcn-vue` 组织习惯
- 导出方式应支持按组件目录导出与包根聚合导出
- 包内组织应优先兼容现有 `app/work` 组件结构，降低迁移成本

## Source Of Truth

`@willow/shadcn` 建立后，以下规则成立：

- 全仓共享的 shadcn 基础组件源代码以 `packages/shadcn` 为准
- `app/work` 内部同名基础组件若继续存在，只能作为过渡兼容层，不应演化为主实现
- `DESIGN.md` 继续定义视觉与使用约束，但不替代组件源码真相源

## Export Strategy

`@willow/shadcn` 需要支持两类消费方式：

1. 包根聚合导出
   - 便于常见组件统一引用
2. 组件目录级导出
   - 便于按现有 `button`、`card`、`dialog` 目录组织进行渐进迁移

设计要求：

- 导出命名保持和现有组件名一致
- 不在 spec 阶段要求一次性重新设计所有 API
- 若现有组件依赖别名或内部工具，需要在实施时同步迁移这些依赖到共享包可用位置

## Migration Strategy

迁移采用渐进式执行，而不是一次性替换。

### Phase 1: 建立共享包骨架

- 创建 `@willow/shadcn` 包
- 确立基础依赖、导出入口和目录约定
- 选择一组已有基础组件作为首批迁移对象

### Phase 2: 迁移共享基础组件

- 从 `app/work/src/renderer/src/components/ui/` 迁移通用基础组件到 `@willow/shadcn`
- 修复包内依赖、路径和公共工具引用
- 在需要时保留 `app/work` 本地 re-export 兼容层，避免业务页面一次性大改

### Phase 3: 消费方切换

- `app/work` 逐步改为消费 `@willow/shadcn`
- `app/ui-playground` 以及后续应用统一从 workspace 包消费
- 新增共享基础组件默认只放入 `@willow/shadcn`

## Component Selection Rules

应迁移到 `@willow/shadcn` 的组件：

- 通用基础交互组件
- 明显属于 shadcn primitives 或其轻量扩展的组件
- 不依赖产品业务语义即可复用的组件

不应迁移到 `@willow/shadcn` 的组件：

- 带有 Willow 业务领域语义的聚合组件
- 聊天消息、Markdown、Tool Renderer 等上层展示组件
- 仅服务于某个页面且无法跨应用复用的局部组件

## Relationship With DESIGN.md

根据仓库约定，renderer、`shadcn-vue` 和页面设计工作都要参考根目录 `DESIGN.md`。

在本变更中，`DESIGN.md` 的作用是：

- 约束 `@willow/shadcn` 所承载组件仍遵守现有 `new-york` + `neutral` 基线
- 保证共享组件不会偏离 Willow 当前桌面工作台视觉语言

但 `DESIGN.md` 不负责：

- 定义共享包目录结构
- 规定 workspace 包职责边界
- 替代本次 OpenSpec 对迁移路径的要求

## Risks And Mitigations

### Risk: 迁移过程中 `@willow/ui` 与 `@willow/shadcn` 职责再次重叠

Mitigation：

- 在 spec 中明确基础组件和上层组件的边界
- 实施时禁止把消息渲染器、页面级组合组件迁入 `@willow/shadcn`

### Risk: `app/work` 现有页面改动面过大

Mitigation：

- 采用渐进迁移
- 允许短期 re-export 兼容层
- 优先迁移基础组件源代码，再逐步切换消费方

### Risk: 包内依赖耦合到 `app/work` 私有路径

Mitigation：

- 实施时同步梳理共享组件依赖的工具函数、样式入口和别名
- 只把可脱离产品业务语义的公共依赖迁入 `@willow/shadcn`

### Risk: 新包建立后仍出现重复实现

Mitigation：

- 在 spec 中明确新增共享基础组件必须优先进入 `@willow/shadcn`
- 把 `app/work` 本地目录定位为消费层或兼容层，而不是新的主实现来源
