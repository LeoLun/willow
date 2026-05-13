# Allow Workspace File Write Edit Implementation Plan

## Scope

对应 OpenSpec change：

- `docs/ai-workflows/openspec/changes/allow-workspace-file-write-edit/proposal.md`
- `docs/ai-workflows/openspec/changes/allow-workspace-file-write-edit/design.md`
- `docs/ai-workflows/openspec/changes/allow-workspace-file-write-edit/tasks.md`
- `docs/ai-workflows/openspec/changes/allow-workspace-file-write-edit/specs/tool-permissions/spec.md`

目标是调整 `@willow/core` 中 `write` 与 `edit` 的 permission 决策：解析后的目标路径在当前 `cwd` 工作空间内时返回 `allow`；工作空间外、`..` 逃逸或 sibling 前缀路径仍返回 `ask`。本计划不改变工具执行语义。

## Assumptions

- `cwd` 是 `CoreAgent` 创建工具时传入的当前工作空间路径。
- `write` 与 `edit` 的路径参数均为 `params.path`。
- `packages/core` 当前没有独立 `test` 脚本；验证优先用可直接执行的最小脚本或补充轻量测试入口，最终仍需运行 `pnpm lint` 和必要的 `pnpm build`。
- 本变更不涉及 `CoreAgent` approval coordinator、前端 UI 或其他工具权限。

## Implementation Slices

### 1. 路径边界 helper

涉及文件：

- `packages/core/src/tools/path-utils.ts`

步骤：

- 保留现有 `resolveToCwd(path, cwd)` API。
- 新增共享 helper，用于判断路径是否解析到 `cwd` 内。建议形态：
  - `isPathInsideCwd(path: string, cwd: string): boolean`
  - 内部先用 `resolveToCwd(path, cwd)` 得到目标绝对路径，再用 `resolve(cwd)` 规范化工作空间根。
- 使用 `path.relative(root, target)` 做边界判断，而不是纯字符串 `startsWith`。
- 判断规则：
  - `relative === ""` 表示目标就是 `cwd` 本身，可视为在工作空间内。
  - `relative` 不以 `..` 开头且不是绝对路径，表示目标在 `cwd` 内。
  - 其他情况为工作空间外。
- 对异常输入或无法解析场景保持保守：返回 `false`，让调用方走 `ask`。

验证点：

- `src/file.ts` 在 `/workspace/project` 内。
- `/workspace/project/src/file.ts` 在 `/workspace/project` 内。
- `nested/../src/file.ts` 在 `/workspace/project` 内。
- `../outside.ts` 不在 `/workspace/project` 内。
- `/tmp/outside.ts` 不在 `/workspace/project` 内。
- `/workspace/project-other/file.ts` 不在 `/workspace/project` 内。

### 2. 更新 `write` permission

涉及文件：

- `packages/core/src/tools/write.ts`
- 可能涉及 `packages/core/src/tools/path-utils.ts`

步骤：

- 将 `write.ts` 的路径解析统一改为 `resolveToCwd(path, cwd)`，保持相对路径和绝对路径执行语义不变。
- 在 `meta.permission(params)` 中调用路径边界 helper：
  - workspace 内：`{ mode: "allow" }`
  - workspace 外：保留现有 `{ mode: "ask", reason: "写入文件会修改工作区内容", risk: "high" }`
- 确认 `execute(...)` 使用的 `absolutePath` 与 permission helper 的解析语义一致。
- 不改变 `mkdir(dirname(absolutePath), { recursive: true })`、`writeFile`、details 和返回文案。

验证点：

- 相对路径写入 permission 为 `allow`。
- 工作空间内绝对路径写入 permission 为 `allow`。
- `../` 逃逸、工作空间外绝对路径和 sibling 前缀路径 permission 为 `ask`。

### 3. 更新 `edit` permission

涉及文件：

- `packages/core/src/tools/edit.ts`

步骤：

- 保留执行阶段 `resolveToCwd(path, cwd)`。
- 在 `meta.permission(params)` 中调用路径边界 helper：
  - workspace 内：`{ mode: "allow" }`
  - workspace 外：保留现有 `{ mode: "ask", reason: "编辑文件会修改工作区内容", risk: "high" }`
- 不改变 `access(...)`、`readFile(...)`、`oldText === newText` 检查、出现次数检查、`writeFile(...)`、diff details 和返回文案。

验证点：

- 相对路径编辑 permission 为 `allow`。
- 工作空间内绝对路径编辑 permission 为 `allow`。
- `../` 逃逸、工作空间外绝对路径和 sibling 前缀路径 permission 为 `ask`。

### 4. 验证策略

优先验证权限 resolver，而不是执行真实外部写入。

可选实现路径：

- 如果现有工具对象可直接访问 `meta.permission`，用一个最小 TypeScript/JavaScript 脚本实例化 `createWriteTool(cwd)`、`createEditTool(cwd)` 并断言 permission 结果。
- 如果导入 TS 源文件不方便，则在实现阶段考虑增加临近 `*.test.ts` 或使用包构建后的 JS 进行验证；不要为了这次变更引入重型测试框架配置。

必须覆盖：

- `write` relative inside -> `allow`
- `write` absolute inside -> `allow`
- `write` `../outside.ts` -> `ask`
- `write` outside absolute -> `ask`
- `write` sibling prefix -> `ask`
- `edit` relative inside -> `allow`
- `edit` absolute inside -> `allow`
- `edit` `../outside.ts` -> `ask`
- `edit` outside absolute -> `ask`
- `edit` sibling prefix -> `ask`

最终命令：

- `pnpm lint`
- `pnpm build`

## Stop Conditions

- 如果 `createTool` 不暴露 `meta.permission`，导致无法按当前方式测试 permission resolver，需要先阅读工具封装并调整验证方案；若必须改变工具公共 API，应回到 `workflow-spec`。
- 如果发现“当前工作空间”不能可靠等同于 `cwd`，需要回到 `workflow-spec` 补充工作空间边界定义。
- 如果实现需要新增 UI 审批状态、approval 数据结构或改动 `CoreAgent` 通用工具执行流程，应停止并回到 `workflow-spec`。

## Handoff To workflow-implement

执行时优先保持改动集中在：

- `packages/core/src/tools/path-utils.ts`
- `packages/core/src/tools/write.ts`
- `packages/core/src/tools/edit.ts`

完成后更新 `docs/ai-workflows/openspec/changes/allow-workspace-file-write-edit/tasks.md` 的任务勾选，并记录实际验证命令与结果。
