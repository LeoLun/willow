# create-willow-shadcn

## Summary

新增工作区级基础组件包 `@willow/shadcn`，把当前散落在各应用内的 `shadcn-vue` 基础组件收敛到统一入口中，形成全仓可复用、可扩展、可维护的组件来源；同时保留 `@willow/ui` 继续承载消息渲染、业务展示和工具型上层组件，不混淆两者职责。

## Problem

当前仓库里的 `shadcn-vue` 基础组件主要位于 `app/work/src/renderer/src/components/ui/`，而 `packages/ui` 仅包含少量基础组件和大量上层展示组件，存在以下问题：

- 基础组件没有 workspace 级单一真相源，不利于多个应用共享
- `app/work` 内部路径承担了“应用私有实现”和“全仓基础组件来源”两种职责，边界模糊
- `@willow/ui` 当前已经承载消息流、Markdown、工具渲染器等上层能力，不适合继续混入完整 shadcn 基础组件体系
- 后续如果 `app/ui-playground`、新 renderer 应用或其他包需要复用基础组件，会继续复制或依赖应用内部路径

## Goals

- 新增 `@willow/shadcn` 作为全仓 `shadcn-vue` 基础组件统一入口
- 明确 `@willow/shadcn` 与 `@willow/ui` 的职责边界
- 为现有 `app/work` 中的基础组件迁移提供可执行的目录与导出规则
- 确保后续应用可以通过 workspace 包复用基础组件，而不是依赖某个应用内部目录

## Non-Goals

- 本次不要求重做现有 `DESIGN.md` 视觉规范
- 本次不要求新增一整套新的设计 token 或替换 `shadcn-vue` 基线
- 本次不要求在 spec 阶段迁移全部业务页面引用
- 本次不要求把 `@willow/ui` 中的上层渲染组件合并进 `@willow/shadcn`

## Success Criteria

- OpenSpec 明确定义 `@willow/shadcn` 的包定位、目录边界、导出方式和迁移原则
- 规范要求基础 shadcn 组件以后以 `@willow/shadcn` 为单一共享来源
- 规范要求 `@willow/ui` 继续专注于消息渲染和更高层 UI 组合，而不是基础组件全集
- 规范定义渐进迁移路径，允许 `app/work` 在实施阶段逐步切换引用

## Viable Approaches

### Approach A: 继续保留 `app/work` 作为基础组件源

直接把 `app/work/src/renderer/src/components/ui/` 视为事实来源，其它应用通过 alias、软链接或复制方式复用。

优点：

- 变更最小
- 短期实现速度快

缺点：

- 应用目录继续承担共享包职责，边界依旧混乱
- 多应用复用时依赖关系脆弱
- 不利于后续发布、测试和统一维护

### Approach B: 新增 `@willow/shadcn` 独立基础组件包

在 `packages/` 下新增或整理出专门的 `@willow/shadcn` 包，把全仓共享的 `shadcn-vue` 基础组件统一收口到该包，并通过包导出给 `app/work`、`app/ui-playground` 等消费方使用。

优点：

- 基础组件边界清晰，符合 workspace 包组织方式
- 可作为全仓单一真相源，降低复制和漂移
- 与 `@willow/ui` 的上层展示职责天然分离

缺点：

- 需要一次性梳理目录、依赖和导出约定
- 实施阶段需要迁移现有引用

### Approach C: 直接把 `packages/ui` 改造成完整 shadcn 包

在现有 `@willow/ui` 基础上继续扩展，把所有 shadcn 基础组件都并入同一个包。

优点：

- 可以复用现有包和接入关系
- 包数量不增加

缺点：

- 会把基础组件与上层渲染组件继续混在一起
- `@willow/ui` 的语义会越来越模糊
- 后续维护和版本边界不清晰

## Recommendation

采用 Approach B。

原因：

- 目前 `@willow/ui` 已经有明确的上层 UI 能力定位，不宜再作为 shadcn 基础组件全集容器
- `app/work` 中现有 `components/ui` 已经足够丰富，适合作为迁移素材，但不应继续停留在应用私有目录中
- 新增 `@willow/shadcn` 最符合 workspace 组织方式，也最利于后续多应用共享和维护

## Assumptions

- `@willow/shadcn` 将作为新的 workspace 包名存在，而不是直接重命名现有 `@willow/ui`
- 实施阶段允许采用渐进迁移，不要求一次性替换所有旧引用
- 视觉与交互规范仍以现有 `DESIGN.md` 和各 feature OpenSpec 为准，`@willow/shadcn` 只解决基础组件归集与复用边界
