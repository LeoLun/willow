# Allow Workspace File Write Edit

## Summary

调整 `@willow/core` 的 `write` 与 `edit` 工具权限策略：当目标文件解析后位于当前工作空间目录内时，新增或修改文件不需要人工 permission 确认；当目标文件位于当前工作空间外时，仍保持人工确认。

## Problem

当前 [write.ts](/Users/liujinglun/code/willow/packages/core/src/tools/write.ts) 和 [edit.ts](/Users/liujinglun/code/willow/packages/core/src/tools/edit.ts) 的 `meta.permission` 都固定返回 `ask`。这意味着即使 AI 只是修改当前工作空间内的文件，也会触发确认，打断常见开发流。

这两个工具由 `CoreAgent` 在当前 `cwd` 工作空间上下文中创建。对当前工作空间内文件的读写是核心开发能力，应当被视为默认允许；对工作空间外路径的写入和编辑仍然需要确认，以避免误改用户其他目录或系统路径。

## Goals

- `write` 写入当前工作空间内的新文件或已有文件时，权限返回 `allow`。
- `edit` 修改当前工作空间内已有文件时，权限返回 `allow`。
- 当目标路径解析后不在当前工作空间内时，`write` 与 `edit` 仍返回 `ask`。
- 绝对路径和包含 `..` 的相对路径必须先解析为绝对目标路径，再判断是否位于当前工作空间内。
- 保留现有工具执行语义：`write` 仍可创建父目录并覆盖文件，`edit` 仍要求 `oldText` 唯一匹配。

## Non-Goals

- 不改变 `bash`、`read`、`grep`、`find`、`ls`、`todo` 等其他工具权限策略。
- 不新增删除文件能力。
- 不新增 UI 审批流或 approval 数据结构。
- 不改变 `write` 与 `edit` 的参数 schema、返回 details 或执行结果文本。
- 不在本次引入 git dirty 检查、文件类型白名单或大小限制。

## Approaches

### Approach A: 在 `write` / `edit` 的 permission resolver 中按目标路径判断

为两个工具的 `meta.permission(params)` 增加路径判断：把 `params.path` 按当前 `cwd` 解析为绝对路径，如果该路径位于 `cwd` 内，则返回 `allow`；否则返回现有 `ask` 风险提示。

优点：

- 变更点小，直接贴近现有工具定义。
- 保留 `CoreAgent` 和 approval coordinator 的现有行为。
- 能分别处理 `write` 与 `edit` 的路径解析差异。

缺点：

- 如果两个工具各自实现路径判断，可能产生重复逻辑。

### Approach B: 抽出共享路径权限 helper

在 `packages/core/src/tools/path-utils.ts` 或相邻模块中增加共享 helper，例如 `isPathInsideCwd(path, cwd)` 或 `classifyWorkspaceFilePermission(path, cwd, action)`，`write` 与 `edit` 都调用它。

优点：

- 避免重复路径边界判断。
- 后续其他文件写入类工具可以复用。
- 更容易集中测试绝对路径、`..`、同名前缀目录等边界。

缺点：

- 比直接内联多一个小抽象。

### Approach C: 在 `CoreAgent` 层统一放行工作空间内写入类工具

保留工具自身 `permission: ask`，在 `CoreAgent` 执行前根据工具名和参数统一覆写为 `allow`。

优点：

- 所有工具权限策略集中在 Agent 调度层。

缺点：

- `CoreAgent` 需要知道具体工具参数结构，耦合更高。
- 破坏当前“工具自己定义权限”的局部性。
- 更容易影响未来工具或 approval 行为。

## Recommendation

采用 Approach B。`write` 和 `edit` 都是文件写入类工具，且都基于 `cwd` 判断当前工作空间边界。抽一个共享路径判断 helper 可以保持实现集中，同时不改变 `CoreAgent` 的通用 approval 流程。

## Success Criteria

- `write` 使用相对路径写入当前工作空间内文件时，不产生 permission 确认。
- `write` 使用绝对路径写入当前工作空间内文件时，不产生 permission 确认。
- `edit` 修改当前工作空间内文件时，不产生 permission 确认。
- `write` 或 `edit` 的路径通过 `..` 逃逸到当前工作空间外时，仍需要 permission 确认。
- `write` 或 `edit` 使用工作空间外绝对路径时，仍需要 permission 确认。
- 路径前缀相似但不属于工作空间的目录不能被误判为工作空间内，例如 `cwd=/tmp/app` 时 `/tmp/app-other/file.ts` 仍需要确认。
