# Workflow Conventions

## Source of Truth

- 产品范围、行为、设计、任务：以 `docs/ai-workflows/openspec/*.md` 和 `docs/ai-workflows/openspec/changes/*/*.md` 为准。
- `docs/ai-workflows/` 用于保存流程文档、计划文档、阶段记录和辅助说明。
- 仓库根目录 `openspec/` 是兼容符号链接；默认阅读和更新真实文件时，应以 `docs/ai-workflows/openspec/` 为准。

## Output Locations

- 工作流总览与阶段说明：`docs/ai-workflows/*.md`
- 执行计划：`docs/ai-workflows/plans/YYYY-MM-DD-<change>.md`

## Naming

- 工作流技能统一使用 `workflow-` 前缀。
- OpenSpec change 名称统一使用 kebab-case。
- `docs/ai-workflows/` 下新增文档统一使用 `YYYY-MM-DD-<topic>.md`。

## Phase Gates

### `workflow-spec` -> `workflow-worktree`

- OpenSpec 变更已创建或已定位到目标 change。
- `proposal.md`、核心 `specs/*/spec.md`、`design.md`、`tasks.md` 至少满足当前实现所需信息。

### `workflow-worktree` -> `workflow-plan`

- 工作树路径已确定。
- 基线校验已完成；如果失败，必须先显式记录失败状态。

### `workflow-plan` -> `workflow-implement`

- 已生成 `docs/ai-workflows/plans/YYYY-MM-DD-<change>.md`。
- 计划中的任务可以直接映射到 OpenSpec 任务或能力点。

### `workflow-implement` -> `workflow-close`

- 计划任务已完成或明确暂停。
- 已有最终验证结果，且与 OpenSpec 范围一致。

## Deprecated Entrypoints

以下入口已废弃，不再作为项目工作流使用：

- `openspec-new-change`
- `openspec-propose`
- `openspec-continue-change`
- `openspec-ff-change`
- `openspec-apply-change`
- `openspec-archive-change`
- `superpowers` 工作流类技能名
