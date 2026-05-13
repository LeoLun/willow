# Design

## Context

`@willow/core` 的工具权限由工具自身的 `meta.permission(params)` 决定，`CoreAgent` 在执行工具前读取该结果；当返回 `ask` 时进入 approval coordinator。

当前相关代码：

- [write.ts](/Users/liujinglun/code/willow/packages/core/src/tools/write.ts)：固定返回 `ask`，执行阶段用 `resolve(cwd, path)` 计算目标路径。
- [edit.ts](/Users/liujinglun/code/willow/packages/core/src/tools/edit.ts)：固定返回 `ask`，执行阶段用 `resolveToCwd(path, cwd)` 计算目标路径。
- [path-utils.ts](/Users/liujinglun/code/willow/packages/core/src/tools/path-utils.ts)：已有 `resolveToCwd(path, cwd)`，可作为共享路径解析基础。

## Decision

### 1. 工作空间内文件写入默认允许

`write` 与 `edit` 的 permission resolver 应根据 `params.path` 和工具创建时的 `cwd` 判断目标路径。

规则：

- 如果解析后的目标绝对路径位于 `cwd` 目录内，返回 `{ mode: "allow" }`。
- 如果解析后的目标绝对路径不在 `cwd` 目录内，返回现有 `ask` 风险等级与说明。
- `cwd` 本身与目标路径都应规范化为绝对路径后比较。
- 判断必须按路径边界处理，不能只用字符串 `startsWith` 粗略匹配。

### 2. 相对路径、绝对路径和 `..` 都必须统一解析

规则：

- 相对路径按 `cwd` 解析。
- 绝对路径保持绝对目标语义。
- 包含 `..` 的路径先解析归一化，再判断是否仍在 `cwd` 内。
- 路径类似 `/workspace-app` 不应因为以 `/workspace` 开头而被视为 `/workspace` 内部。

### 3. 执行语义不变

本变更只改变 permission 决策，不改变工具执行阶段行为。

要求：

- `write` 仍可创建父目录并覆盖目标文件。
- `edit` 仍先检查读写权限，读取文件后要求 `oldText` 唯一匹配。
- 工具 details 和返回文案保持兼容。
- 工作空间外路径在用户确认后仍可按既有执行逻辑运行。

## Implementation Notes

- 可以在 `path-utils.ts` 增加共享 helper，例如：
  - `resolveToCwd(path, cwd)` 继续负责解析。
  - `isPathInsideCwd(path, cwd)` 或 `isWithinCwd(absolutePath, cwd)` 负责边界判断。
- `write.ts` 应避免继续使用与 `edit.ts` 不一致的路径解析方式；实现阶段可统一改用 `resolveToCwd`，前提是执行结果不变。
- `write` 与 `edit` 可以各自保留不同的 `ask` reason 文案，但工作空间内均应 `allow`。
- 如果 `cwd` 为空、非法或无法规范化，permission 应保守返回 `ask`。

## Risks

- 路径判断如果只做字符串前缀匹配，可能错误放行 sibling 目录。
- 符号链接边界可能带来语义差异。本次以解析后的路径是否位于 `cwd` 内作为基础规则，不要求在 permission 阶段强制 realpath，因为 `write` 可能面向尚不存在的新文件。
- 过度放行工作空间内写入会减少确认次数，但这符合当前开发型 agent 的工作空间信任模型。

## Open Questions

- 本次不要求识别 git ignored 文件、隐藏目录或 lockfile 等特殊路径。
- 本次不要求为工作空间内“覆盖已有文件”和“新增文件”设计不同确认策略。
