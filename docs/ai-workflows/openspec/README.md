# OpenSpec

本目录保存项目的需求真相源。

仓库根目录的 `openspec/` 是指向这里的兼容符号链接，目的是让仍然固定写入 `openspec/` 的 OpenSpec CLI 继续可用。

- `docs/ai-workflows/openspec/changes/<change>/proposal.md`：变更背景、范围、价值与成功标准
- `docs/ai-workflows/openspec/changes/<change>/design.md`：实现前必须对齐的设计决策
- `docs/ai-workflows/openspec/changes/<change>/tasks.md`：后续 `workflow-plan` / `workflow-implement` 的任务基线
- `docs/ai-workflows/openspec/changes/<change>/specs/*/spec.md`：面向实现的能力规格

若 `docs/ai-workflows/` 与本目录冲突，以本目录为准。
