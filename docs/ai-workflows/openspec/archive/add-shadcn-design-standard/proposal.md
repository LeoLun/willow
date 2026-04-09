# add-shadcn-design-standard

## Summary

为 Willow 桌面端 renderer 新增一份项目级 `DESIGN.md` 设计约束文档，参考 `VoltAgent/awesome-design-md` 的文档组织方式，但内容完全基于本仓库现有 `shadcn-vue` 配置、CSS variables 与 Electron 桌面工作台场景整理，不引入新的品牌体系或 UI 重构。

## Problem

当前仓库已经接入 `shadcn-vue`，也有基础 theme token 与组件目录，但缺少一份统一的长期设计标准。AI 代理和前端工程师在新增页面、对话框、空状态、设置表单时，容易出现以下问题：

- 视觉语言不稳定，同类页面的布局和信息密度不一致
- 组件层级容易漂移，主次操作和危险操作没有统一约束
- 容易写出偏营销化的界面，不符合桌面工作台产品气质
- prompt 中缺少明确的 UI 合同，导致 AI 生成结果需要反复修正

## Goals

- 为 Willow renderer 建立统一的 shadcn-vue 设计语言与 AI 生成约束
- 将现有 `components.json` 与 `index.css` 中的事实整理为可执行的设计标准
- 为列表页、设置页、弹窗表单等常见桌面端界面提供标准骨架与组件配方
- 为 AI 和工程师提供可直接复用的 prompt-style guidance

## Non-Goals

- 本次不修改现有主题 token、组件实现或页面代码
- 本次不新增独立的品牌色体系、字体系统或营销页视觉规范
- 本次不替代 feature 级 OpenSpec 设计文档，`DESIGN.md` 只作为长期 UI 约束

## Success Criteria

- 仓库根目录新增 `DESIGN.md`，并完整覆盖视觉基线、布局模式、组件配方、状态规范、Do / Don't 和 AI prompt contract
- 新增独立 OpenSpec change，补齐 `proposal.md`、`design.md`、`tasks.md`、`specs/*/spec.md`
- 新增执行计划文件，便于后续 `workflow-implement` / `workflow-close` 追踪
- `AGENTS.md` 增加最小必要入口，明确 renderer / shadcn-vue 任务优先参考仓库根 `DESIGN.md`

## Viable Approaches

### Approach A: 通用 shadcn-vue 文档模板

围绕组件与布局写一份可跨项目复用的泛化规范。

优点：
- 复用性高
- 文档结构容易整理

缺点：
- 与 Willow 当前 token、页面气质和桌面端场景耦合不足
- 不能直接约束本项目 AI 生成结果

### Approach B: 基于 Willow 现状的项目专属标准

以现有 `new-york` 风格、`neutral` 基底和 CSS variables 为事实基线，整理成项目长期设计标准。

优点：
- 最符合当前仓库真实情况
- AI 代理和工程师都能直接执行
- 不需要引入新的视觉系统

缺点：
- 复用到其他项目时需要改写

### Approach C: 先重做主题，再写规范

先定义一套全新视觉体系，再围绕新视觉输出 `DESIGN.md`。

优点：
- 可一次性形成强品牌表达

缺点：
- 明显超出当前请求范围
- 会把文档变更升级成 UI 重构项目

## Recommendation

采用 Approach B。它能在不改动现有实现的前提下，把仓库已经存在的 shadcn-vue 配置和主题 token 沉淀成稳定、可执行的设计标准，同时为后续 AI 协作提供统一约束。
