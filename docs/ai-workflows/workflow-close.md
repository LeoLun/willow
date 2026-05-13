# workflow-close

`workflow-close` 用于完成最终验证、审查、交付说明和 OpenSpec 归档。

## 何时使用

- 计划中的实现任务已完成
- 准备发起合并、交付或结束当前 change
- 需要确认实现没有偏离 OpenSpec

## 标准动作

1. 回读 OpenSpec 与最终变更。
2. 运行最终验证命令并核对结果。
3. 审查需求覆盖、回归风险和文档一致性。
4. 给出合并/交付建议。
5. 在满足条件时归档 OpenSpec change。

## 输出

- 最终验证结果
- 风险与后续项
- 归档或未归档的原因

## 示例

```text
请使用 workflow-close，为 add-automation-feature 做最终检查；
如果实现与 OpenSpec 一致，就给出归档与合并建议。
```
