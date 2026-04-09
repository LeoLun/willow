# AI Workflows

本目录定义项目内统一的 AI 工作流。当前只允许使用 `workflow-*` 工作流推进需求、计划、实现与收尾。

## 核心原则

- `docs/ai-workflows/openspec/*.md` 与 `docs/ai-workflows/openspec/changes/*/*.md` 是唯一需求真相源。
- `workflow-*` 负责流程推进，不负责替代 OpenSpec 产物。
- 所有新的流程性文档都写到 `docs/` 下。
- 仓库根目录的 `openspec/` 仅保留为兼容 OpenSpec CLI 的符号链接。

## 五阶段闭环

| 阶段 | 工作流 | 目的 | 主要输出 |
| --- | --- | --- | --- |
| 1 | `workflow-spec` | 澄清需求并生成/更新 OpenSpec 变更 | `docs/ai-workflows/openspec/changes/<change>/` |
| 2 | `workflow-worktree` | 建立隔离开发环境 | worktree 路径、基线校验结果 |
| 3 | `workflow-plan` | 将 OpenSpec 任务细化为可执行计划 | `docs/ai-workflows/plans/YYYY-MM-DD-<change>.md` |
| 4 | `workflow-implement` | 严格依规实现与验证 | 代码改动、任务进度、验证结果 |
| 5 | `workflow-close` | 审查、收尾、归档 | 交付总结、归档后的 change 状态 |

## 文档入口

- [约定说明](./conventions.md)
- [workflow-spec](./workflow-spec.md)
- [workflow-worktree](./workflow-worktree.md)
- [workflow-plan](./workflow-plan.md)
- [workflow-implement](./workflow-implement.md)
- [workflow-close](./workflow-close.md)
- [plans 目录说明](./plans/README.md)

## 推荐顺序

1. 新功能或需求变更：先用 `workflow-spec`
2. 准备开始实现：用 `workflow-worktree`
3. OpenSpec 已有任务：用 `workflow-plan`
4. 执行计划：用 `workflow-implement`
5. 完工与归档：用 `workflow-close`

## 中途续跑

- 只要已有 `docs/ai-workflows/openspec/changes/<change>/`，可以直接从 `workflow-spec`、`workflow-plan`、`workflow-implement` 或 `workflow-close` 中与当前状态匹配的阶段继续。
- 判断依据优先看 OpenSpec 产物是否齐全，再看 `docs/ai-workflows/` 里的计划与记录。
