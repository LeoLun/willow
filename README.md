# willow

本项目已将 OpenSpec 与 Superpowers 合并为项目内统一的 `workflow-*` 工作流。后续所有 AI 协作都应遵循这套流程。

## 核心原则

- `docs/ai-workflows/openspec/*.md` 与 `docs/ai-workflows/openspec/changes/*/*.md` 是唯一需求真相源。
- `workflow-*` 负责推进流程，不替代 OpenSpec 产物。
- 新增流程文档统一写入 `docs/ai-workflows/`。
- 仓库根目录的 `openspec/` 只是兼容 OpenSpec CLI 的符号链接，真实文件位于 `docs/ai-workflows/openspec/`。

## 标准工作流

| 阶段 | 工作流 | 用途 | 主要输出 |
| --- | --- | --- | --- |
| 1 | `workflow-spec` | 澄清需求、生成或续写 OpenSpec 变更 | `docs/ai-workflows/openspec/changes/<change>/` |
| 2 | `workflow-worktree` | 建立隔离开发环境并确认基线 | worktree 路径、基线验证 |
| 3 | `workflow-plan` | 将 OpenSpec 任务拆成可执行计划 | `docs/ai-workflows/plans/YYYY-MM-DD-<change>.md` |
| 4 | `workflow-implement` | 按计划和 OpenSpec 执行实现与验证 | 代码改动、任务进度、验证结果 |
| 5 | `workflow-close` | 最终审查、交付、归档 | 最终验证、风险说明、归档状态 |

完整文档见 [docs/ai-workflows/README.md](./docs/ai-workflows/README.md)。

## 推荐使用方式

### 新需求

```text
请使用 workflow-spec，为“<需求名称>”创建或继续一个 OpenSpec change，
补齐 proposal、specs、design、tasks，并告诉我下一步该进入哪个阶段。
```

### 准备实现

```text
请使用 workflow-worktree，为 <change-name> 准备独立 worktree，
确认基线是否干净。
```

```text
请使用 workflow-plan，基于 <change-name> 的 OpenSpec 任务，
输出一个可直接执行的计划到 docs/ai-workflows/plans/。
```

### 实现与收尾

```text
请使用 workflow-implement，按 docs/ai-workflows/plans/<date>-<change>.md 执行下一步实现，
每步后给出验证结果。
```

```text
请使用 workflow-close，为 <change-name> 做最终检查；
如果实现与 OpenSpec 一致，就给出归档与合并建议。
```

## 目录约定

- OpenSpec 真相源：`docs/ai-workflows/openspec/`
- OpenSpec 兼容入口：`openspec/` -> `docs/ai-workflows/openspec/`
- 工作流文档：`docs/ai-workflows/`
- 阶段说明：`docs/ai-workflows/workflow-*.md`
- 执行计划：`docs/ai-workflows/plans/`

## 已废弃入口

以下旧入口不再作为项目标准工作流使用：

- `openspec-new-change`
- `openspec-propose`
- `openspec-continue-change`
- `openspec-ff-change`
- `openspec-apply-change`
- `openspec-archive-change`
- `superpowers` 工作流类技能名

## 典型闭环

1. 用 `workflow-spec` 把需求固化到 OpenSpec。
2. 用 `workflow-worktree` 准备隔离环境。
3. 用 `workflow-plan` 把 `tasks.md` 拆成执行计划。
4. 用 `workflow-implement` 逐步实现并验证。
5. 用 `workflow-close` 做最终检查与归档。
