# workflow-implement

`workflow-implement` 用于按 OpenSpec 和执行计划完成代码实现。

## 何时使用

- `workflow-plan` 已产出执行计划
- 已知当前要做的任务切片
- 需要严格执行验证，不希望实现偏离规格

## 标准动作

1. 读取 OpenSpec 产物和对应计划。
2. 先证明当前任务尚未完成，再开始实现。
3. 做最小改动以满足当前任务。
4. 重新运行验证并记录结果。
5. 更新任务进度，继续下一步或在发现规格缺口时退回 `workflow-spec`。

## 执行纪律

- 任何行为变更都必须以 OpenSpec 为依据
- 不能跳过验证直接宣布完成
- 自动化测试不足时，必须写清人工验证方式
- 遇到设计冲突时先回补 OpenSpec，而不是在代码里自行扩展

## 示例

```text
请使用 workflow-implement，按 docs/ai-workflows/plans/2026-04-09-add-automation-feature.md
执行下一步实现，并在每步后给出验证结果。
```
