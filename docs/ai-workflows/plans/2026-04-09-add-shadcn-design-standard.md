# 2026-04-09 add-shadcn-design-standard

## Goal

基于 `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/` 的最终范围，为 Willow 新增一套项目级 `DESIGN.md` 标准，并把它接入现有 AI 工作流入口。

## OpenSpec Inputs

- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/proposal.md`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/design.md`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/tasks.md`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/specs/design-language/spec.md`

## Current Code Anchors

- `app/work/components.json`
- `app/work/src/renderer/index.css`
- `app/work/src/renderer/src/components/ui/`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/`
- `docs/ai-workflows/plans/README.md`
- `AGENTS.md`

## Assumptions

- 默认采用项目专属方向，而不是通用 shadcn-vue 模板库文档
- 默认文档主语言为中文，组件名和 token 名保持英文
- 默认不修改现有 renderer token 或组件实现，只沉淀规范

## Dependencies

- `DESIGN.md` 的内容必须与 `app/work/components.json` 和 `app/work/src/renderer/index.css` 保持一致
- `AGENTS.md` 的入口说明必须与仓库既有 workflow 约定兼容，不能削弱 OpenSpec 的 source-of-truth 地位
- 执行计划只描述文档落地顺序和验证方式，不重定义 OpenSpec 行为边界

## Blockers And Escalation Rules

- 当前没有硬 blocker
- 如果在撰写计划或文档时发现需要新增 token、组件、字体或页面重构，先回到 `workflow-spec` 更新范围
- 如果 `DESIGN.md` 需要承担 feature-level 行为说明，先回到 `workflow-spec` 澄清职责边界，不在计划里私自扩义

## Execution Slices

### Slice 1: OpenSpec Baseline

目标：
- 新建独立 change，定义范围、设计边界和验收标准

涉及文件 / 子系统：
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/proposal.md`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/design.md`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/tasks.md`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/specs/design-language/spec.md`

实施步骤：
1. 创建并完成 `add-shadcn-design-standard` change 目录
2. 补齐 `proposal.md`、`design.md`、`tasks.md`、核心 `spec.md`
3. 明确 `DESIGN.md` 的职责、章节结构和工作流边界

验证：
- OpenSpec 文档完整可读，且与请求范围一致

停手条件：
- OpenSpec 已足以支撑 `DESIGN.md` 撰写与 workflow 接入，不需要实现阶段再补高层设计决策

### Slice 2: Root `DESIGN.md`

目标：
- 产出可直接指导后续 renderer 实现与 AI 生成的项目级设计标准

涉及文件 / 子系统：
- `DESIGN.md`
- `app/work/components.json`
- `app/work/src/renderer/index.css`
- `app/work/src/renderer/src/components/ui/`

实施步骤：
1. 依据 `components.json` 和 `index.css` 整理视觉基线
2. 写明排版密度、布局模式和常见页面骨架
3. 为核心 `shadcn-vue` 组件补充项目内 recipe
4. 增加 Do / Don't 与 AI prompt contract

验证：
- 文档覆盖视觉基线、布局、组件、状态和 prompt 模板
- 文档不要求仓库中不存在的 token 或组件

停手条件：
- `DESIGN.md` 已能独立指导列表页、设置页和弹窗表单的设计输出，不需要额外补口头设计说明

### Slice 3: Workflow Integration

目标：
- 让后续协作默认能找到并正确使用 `DESIGN.md`

涉及文件 / 子系统：
- `AGENTS.md`
- `docs/ai-workflows/plans/2026-04-09-add-shadcn-design-standard.md`
- 仓库根 `DESIGN.md`

实施步骤：
1. 在 `AGENTS.md` 增加对 `DESIGN.md` 的最小入口说明
2. 明确 `DESIGN.md` 与 OpenSpec 的职责边界

验证：
- renderer / shadcn-vue 任务入口已明确
- feature-level source of truth 仍保持为 OpenSpec

停手条件：
- 新任务进入时，AI 和工程师都能先读 OpenSpec，再读 `DESIGN.md`，且不会把两者职责混淆

### Slice 4: Verification And Closeout Input

目标：
- 在进入 `workflow-close` 前收集足够的文档型验证证据

涉及文件 / 子系统：
- `DESIGN.md`
- `AGENTS.md`
- `docs/ai-workflows/openspec/archive/add-shadcn-design-standard/`
- `docs/ai-workflows/plans/2026-04-09-add-shadcn-design-standard.md`

实施步骤：
1. 校验新增文档路径与命名是否符合仓库约定
2. 逐项核对 `DESIGN.md` 是否覆盖 OpenSpec 约束的全部章节
3. 交叉核对 `DESIGN.md` 中提到的 token、组件和页面模式是否都能在仓库中找到事实来源
4. 记录任何与仓库现状不一致的项，必要时回退到 `workflow-spec`

验证：
- 文档位置正确
- 章节覆盖完整
- 内容与仓库事实一致

停手条件：
- 已有足够证据证明这是一份可执行的长期 UI 标准文档，可以交给 `workflow-close`

## Recommended Order

1. Slice 1
2. Slice 2
3. Slice 3
4. Slice 4

## Verification

- 校验新文件路径与命名符合仓库约定
- 逐项核对 `DESIGN.md` 是否覆盖计划要求的全部章节
- 核对文档内容与当前 `shadcn-vue` 配置、CSS token 和 UI 组件目录一致

## Notes For `workflow-implement`

- 这是纯文档 change，不需要引入运行时代码或依赖变更
- 实施时优先保持内容和现有仓库事实对齐，不要趁机扩展设计系统范围
- 如果发现 `DESIGN.md` 无法表达某个未来页面的需求，应先更新 OpenSpec 或另起 change，而不是在实现阶段临时追加未审阅规则

## Notes For `workflow-close`

- 本次交付为文档变更，无运行时代码改动
- 收尾时重点检查文档职责边界是否清晰，避免形成多个产品真相源

## Final Verification Results

- `pnpm lint`：通过
- OpenSpec 变更文件：已存在且路径正确
- `DESIGN.md` 章节覆盖：通过
- `DESIGN.md` 与 `components.json`、`index.css`、`components/ui/` 一致性：通过
- `AGENTS.md` 入口与职责边界：通过

## Closeout Status

- 需求覆盖：已满足 `proposal.md`、`design.md`、`spec.md` 与 `tasks.md` 定义范围
- 已知风险：无运行时代码风险；仅需在后续真实页面实现中持续遵守 `DESIGN.md`
- 延后项：无
- 交接建议：后续 renderer / `shadcn-vue` 页面任务默认先读 OpenSpec，再读仓库根 `DESIGN.md`
