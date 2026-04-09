# workflow-worktree

`workflow-worktree` 用于在开始实现前创建一个隔离且可验证的开发环境。

## 何时使用

- OpenSpec 和计划已准备好，准备写代码
- 当前工作区不适合直接实现
- 需要为一个 change 建立独立分支/worktree

## 标准动作

1. 检查现有 worktree 位置与是否可复用。
2. 选择与 change 对应的分支名。
3. 创建 worktree，必要时完成依赖安装。
4. 运行基线验证命令，确认起点状态。
5. 报告 worktree 路径与验证结果。

## 输出

- worktree 路径
- 基线校验结果
- 后续建议转入 `workflow-plan` 或 `workflow-implement`

## 示例

```text
请使用 workflow-worktree，为 add-automation-feature 准备独立 worktree，
确认基线是否干净，然后告诉我是否可以开始实现。
```
