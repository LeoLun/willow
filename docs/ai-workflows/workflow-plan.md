# workflow-plan

`workflow-plan` 用于把 OpenSpec 任务清单细化成可以直接执行的计划。

## 何时使用

- `tasks.md` 已存在，但粒度还不足以稳定实现
- 需要把任务拆成小步并补充验证方式
- 需要一个可复用的执行计划文档

## 标准动作

1. 读取当前 change 的 `proposal.md`、`specs/*/spec.md`、`design.md`、`tasks.md`。
2. 将任务拆成小而可验证的执行切片。
3. 为每个切片补充目标文件或子系统、验证命令、完成判定。
4. 将计划写入 `docs/ai-workflows/plans/YYYY-MM-DD-<change>.md`。

## 输出

- `docs/ai-workflows/plans/YYYY-MM-DD-<change>.md`

## 计划要求

- 每一步都能直接执行
- 每一步都带有验证方式
- 对缺失规格要回退到 `workflow-spec`，不能在计划里擅自补产品定义

## 示例

```text
请使用 workflow-plan，基于 add-automation-feature 的 OpenSpec 任务，
输出一个可直接执行的计划到 docs/ai-workflows/plans/。
```
