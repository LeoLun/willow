# OpenSpec

本目录保存项目的需求真相源。

仓库根目录的 `openspec/` 是指向这里的兼容符号链接，目的是让仍然固定写入 `openspec/` 的 OpenSpec CLI 继续可用。

- `docs/ai-workflows/openspec/changes/<change>/`：进行中的 OpenSpec change
- `docs/ai-workflows/openspec/archive/<change>/`：已完成并归档的 OpenSpec change
- `docs/ai-workflows/openspec/changes/<change>/proposal.md`：变更背景、范围、价值与成功标准
- `docs/ai-workflows/openspec/changes/<change>/design.md`：实现前必须对齐的设计决策
- `docs/ai-workflows/openspec/changes/<change>/tasks.md`：后续 `workflow-plan` / `workflow-implement` 的任务基线
- `docs/ai-workflows/openspec/changes/<change>/specs/*/spec.md`：面向实现的能力规格

归档规则：

- `changes/` 只保留仍在推进中的 change
- 完成并通过 `workflow-close` 的 change 移动到 `archive/`
- 归档后，历史内容仍然属于需求真相源的一部分，但不再作为活跃变更继续推进

若 `docs/ai-workflows/` 与本目录冲突，以本目录为准。
