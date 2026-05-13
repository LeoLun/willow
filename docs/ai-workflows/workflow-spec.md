# workflow-spec

`workflow-spec` 用于把一个需求从“想法”推进到“可实现的 OpenSpec 变更”。

## 何时使用

- 新建功能、修复、流程改动
- 需求还不够清晰
- 已有 change 需要续写 proposal/spec/design/tasks
- 实现中发现 OpenSpec 不足，需要回补规格

## 标准动作

1. 先探索仓库与现有 OpenSpec 变更，确认是否已有对应 change。
2. 澄清目标、边界、约束、成功标准。
3. 方案仍有分歧时，给出 2-3 个方案和推荐。
4. 生成或更新 `docs/ai-workflows/openspec/changes/<change>/proposal.md`、`specs/*/spec.md`、`design.md`、`tasks.md`。

## 输出

- OpenSpec 变更产物

## 结束条件

- OpenSpec 已能支撑后续计划或实现
- 下一步明确转到 `workflow-worktree` 或 `workflow-plan`

## 示例

```text
请使用 workflow-spec，为“桌面端自动化触发器”创建或继续一个 OpenSpec change，
先补齐 proposal、核心 specs、design 和 tasks，再告诉我下一步该进哪个阶段。
```
