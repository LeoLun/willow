# add-workspace-init-command 修订执行计划

## 目标

按 `docs/ai-workflows/openspec/changes/add-workspace-init-command/` 的当前规格，完成“工作空间 Agent”能力的剩余实现与纠偏：

- 工作空间 `AGENTS.md` 必须以 YAML frontmatter 提供 `name` / `description`
- 对话页像发现 skill 一样读取可用工作空间 Agent，并在 `/` 资源面板展示
- 用户可通过 `/` 显式指定工作空间 Agent，本轮发送以结构化字段进入主进程
- 对话主 Agent 可按需调用工作空间子 Agent，显式指定优先于自动路由
- 工作空间委派必须创建独立子 Agent 会话，并表现为独立 tool 调用 UI
- `/init` 必须通过真实 LLM 生成或改进 `AGENTS.md`，不能退化为本地模板直出

本计划是实现视图；产品语义以 OpenSpec 的 `proposal.md`、`design.md`、`specs/*/spec.md` 和 `tasks.md` 为准。

## 当前状态

### 已知基线

- 工作区已有大量未提交实现文件，包含工作空间 Agent 服务、`/init` 服务、sender 资源扩展、委派 tool renderer 等。
- 旧计划 `docs/ai-workflows/plans/2026-05-18-add-workspace-init-command.md` 记录了部分实现进度，包括 `/init` LLM 链路、独立子会话、委派卡片和工作空间索引注入。
- 本轮 OpenSpec 已从“中文名称 / 描述为主规范”修订为“YAML frontmatter `name` / `description` 为机器解析规范，中文正文仅作迁移辅助”。

### 首要纠偏

- 任何读取工作空间 Agent 摘要的实现，都必须优先解析 `AGENTS.md` 顶部 YAML frontmatter。
- 缺少 frontmatter、`name` 或 `description` 的工作空间不得进入自动路由可用列表。
- 正文中文“名称”“描述”只能作为 `/init` 改进时的迁移线索，不能作为可自动调度依据。
- `/init` 生成或改进后的 `AGENTS.md` 必须以 frontmatter 开头，并校验 `name` / `description` 完整。

## 执行切片

```text
阶段 0：保护现有工作区与确认实现偏差
阶段 1：frontmatter 解析与 /init 输出契约纠偏
阶段 2：slash 资源与发送 payload 对齐
阶段 3：工作空间委派 tool 与独立子会话边界复核
阶段 4：自动路由与显式指定优先收敛
阶段 5：端到端验证与收尾
```

每个阶段都应先完成最小可验证闭环，再进入下一阶段。

## 阶段 0：保护现有工作区与确认实现偏差

### 目标

在实施前明确当前未提交代码与规格差距，避免覆盖已有实现或把旧计划假设继续扩散。

### 重点文件

- `app/work/src/main/service/workspace-agent.service.ts`
- `app/work/src/main/service/workspace-init.service.ts`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- `app/work/src/shared/api.ts`
- `packages/sender/src/types.ts`
- `packages/sender/src/components/ResourcePickerPanel.vue`
- `packages/sender/src/components/Sender.vue`
- `packages/ui/src/renderers/WorkspaceDelegateToolRenderer.vue`
- `packages/ui/src/renderers/WorkspaceDelegateRendererFactory.ts`

### 实施步骤

1. 读取上述文件当前内容，标记哪些改动已经满足新 OpenSpec，哪些仍沿用旧中文字段假设。
2. 查看 `git diff`，区分已有实现、文档修改和非本任务相关改动。
3. 形成待修正清单，特别关注 frontmatter 解析、发送 payload、子会话边界和 tool UI 数据结构。

### 停手条件

- 如果当前工作区存在与本任务直接冲突的用户改动，暂停并向用户确认。
- 如果发现 OpenSpec 缺少必要产品决策，回到 `workflow-spec`，不要在计划或实现里补产品行为。

## 阶段 1：frontmatter 解析与 `/init` 输出契约纠偏

### 目标

让工作空间 Agent 摘要与 `/init` 生成结果统一使用 YAML frontmatter `name` / `description`。

### 实施步骤

1. 在 `workspace-agent.service.ts` 或等价服务中实现严格 frontmatter 解析。
2. 解析成功时返回 `workspaceId`、`workspaceName`、`agentName`、`agentDescription`、`workspacePath`、`available`。
3. 缺少 frontmatter、`name` 或 `description` 时返回不可自动调度状态，必要时带上可读提示。
4. 将正文中文“名称”“描述”仅作为迁移辅助信息，不作为 `available: true` 的依据。
5. 更新 `workspace-init.service.ts` 的 LLM 提示词，要求输出以 frontmatter 开头。
6. 写回前校验 `AGENTS.md` 是否以 frontmatter 开头，且 `name` / `description` 完整。
7. 若 LLM 输出缺失 frontmatter 或字段，执行一次受控修复重写或返回清晰失败。

### 验证

- 构造有完整 frontmatter 的 `AGENTS.md`，能被解析为可用工作空间 Agent。
- 构造只有中文正文“名称”“描述”的 `AGENTS.md`，不会进入自动调度可用列表。
- 执行 `/init` 后生成内容顶部包含 `name` / `description` frontmatter。

## 阶段 2：slash 资源与发送 payload 对齐

### 目标

对话页 `/` 资源面板展示工作空间 Agent，并将显式选择作为结构化字段发送。

### 实施步骤

1. 确认 shared API 中存在工作空间 Agent 引用结构，至少包含 `workspaceId`、`agentName`、`workspaceName`。
2. 确认 sender 资源模型中 `workspace-agent` 与 `builtin-command` 不复用 `selectedSkills`。
3. 在对话作用域展示 `workspace-agent` 分组，标题使用 frontmatter `name`，副信息使用 frontmatter `description` 或工作空间名。
4. 在项目工作空间作用域展示 `/init`，在 `conversation` 作用域隐藏 `/init`。
5. 选择工作空间 Agent 后插入结构化引用，发送时进入 payload，而不是留作普通正文。
6. 确认选择 `/init` 后走专用执行分支，并保持与 skill invocation 同层级的选择态与反馈路径。

### 验证

- 对话页输入 `/` 能看到可用工作空间 Agent。
- 缺少 frontmatter 的工作空间不显示为可用 Agent，或显示为不可用提示但不可被自动路由。
- 项目工作空间中能看到 `/init`，对话作用域中看不到 `/init`。
- 显式选择工作空间 Agent 后，主进程收到结构化目标。

## 阶段 3：工作空间委派 tool 与独立子会话边界复核

### 目标

确认工作空间委派不是“切换主 Agent cwd”，而是真正创建独立子 Agent 会话，并在主会话中表现为 tool。

### 实施步骤

1. 复核委派入口是否创建独立 `childSessionId` 或等价持久化会话实体。
2. 确认子 Agent 在目标工作空间 `cwd`、该工作空间 `AGENTS.md` 与技能集合下构建上下文。
3. 确认主 Agent 不复用子 Agent 的完整消息历史。
4. 确认子 Agent 只向主 Agent 回传最终执行结果、失败原因或停止结论。
5. 确认中间工具调用、审批过程和过程消息只保留在子会话中，除非当前架构已有明确的审批透传机制。
6. 确认主会话中存在独立工作空间委派 tool 调用记录，而不是普通 assistant 文本描述。
7. 确认 tool 结果包含 `childSessionId`、目标工作空间信息、状态与结果摘要。
8. 确认 renderer 的委派卡片支持“查看子会话”跳转。

### 验证

- 显式委派一次工作空间 Agent，会生成独立子会话。
- 主会话消息流展示工作空间委派 tool 卡片。
- tool 卡片只展示最终摘要，不展开子 Agent 内部工具调用列表。
- 点击卡片能跳转到对应子会话并查看完整过程。
- 停止主会话时，正在运行的子 Agent 能同步停止或返回明确停止结论。

## 阶段 4：自动路由与显式指定优先收敛

### 目标

在子会话与 tool 边界稳定后，让对话主 Agent 具备按需自动委派能力，同时严格尊重显式指定。

### 实施步骤

1. 对话作用域系统上下文只注入可用工作空间 Agent 的精简索引：`workspaceName`、`agentName`、`agentDescription`。
2. 不把整份 `AGENTS.md` 注入每轮对话，避免上下文膨胀。
3. 本轮 payload 带有显式工作空间 Agent 时，直接委派该目标，不再重新自动选择。
4. 无显式目标时，主 Agent 根据工作空间索引判断是否调用工作空间委派 tool。
5. 明显匹配时创建子会话；不明显时由主 Agent 直接回答。
6. 若当前自动委派仍是文本匹配实现，应记录为临时过渡，并尽快切到 LLM/tool 驱动的判断链路。

### 验证

- 显式指定目标优先于自动路由。
- 明显属于某工作空间职责的请求会调用委派 tool。
- 泛化闲聊或不匹配请求不会创建空转子会话。
- 主 Agent 的工作空间索引只包含摘要字段，不包含完整 `AGENTS.md`。

## 阶段 5：端到端验证与收尾

### 手动验证

1. 在项目工作空间执行 `/init`，验证新建路径。
2. 在已有 `AGENTS.md` 的项目工作空间执行 `/init`，验证改进路径和约束保留。
3. 检查生成文件顶部 frontmatter 是否包含 `name` / `description`。
4. 切换到对话页，打开 `/`，验证工作空间 Agent 可见。
5. 显式选择某个工作空间 Agent 并发送任务，验证结构化 payload、独立子会话、tool 卡片和跳转。
6. 不显式选择，发送明显匹配某工作空间的任务，验证自动委派。
7. 发送不匹配任何工作空间的任务，验证主 Agent 直接处理。
8. 触发子 Agent 工具调用或长任务，验证停止、失败和过程隔离。

### 自动检查

```bash
pnpm lint
pnpm build
```

如果类型检查或构建暴露已存在的非本任务问题，应记录具体阻塞文件与原因，不要顺手重构无关区域。

## 高概率改动清单

- `app/work/src/main/service/workspace-agent.service.ts`
- `app/work/src/main/service/workspace-init.service.ts`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- `app/work/src/main/app.module.ts`
- `app/work/src/main/controllers/workspace/get.workspace.agents.controller.ts`
- `app/work/src/main/controllers/session/send.messgae.controller.ts`
- `app/work/src/shared/api.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/shared/hook/skill.hook.ts`
- `app/work/src/preload/preload.ts`
- `app/work/src/renderer/src/pages/chat/Chat.vue`
- `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue`
- `packages/core/src/system-prompt.ts`
- `packages/sender/src/types.ts`
- `packages/sender/src/index.ts`
- `packages/sender/src/components/Sender.vue`
- `packages/sender/src/components/ResourcePickerPanel.vue`
- `packages/sender/src/components/Editor.vue`
- `packages/sender/src/components/BuiltinCommandTagView.vue`
- `packages/sender/src/extensions/builtin-command-tag.ts`
- `packages/ui/src/renderers/WorkspaceDelegateToolRenderer.vue`
- `packages/ui/src/renderers/WorkspaceDelegateRendererFactory.ts`
- `packages/ui/src/renderers/registry.ts`

## 依赖与假设

- 现有会话模型可以表达“由对话发起、归属某项目工作空间”的独立子会话。
- 现有 tool renderer 体系可以注册工作空间委派 renderer。
- 当前工作区已有未提交代码，实施时必须先读 diff 并保留用户或前序实现的有效改动。
- `AGENTS.md` frontmatter 是机器解析唯一规范；中文正文是人类说明和迁移辅助。

## 停手条件

- 如果无法创建独立子会话，只能通过切换主 Agent `cwd` 模拟委派，停止并回到 `workflow-spec`。
- 如果主会话必须消费子 Agent 中间工具事件流才能完成当前架构，停止并回到 `workflow-spec`。
- 如果 `/init` 无法经由真实 LLM 生成或重写 `AGENTS.md`，停止并先修复该链路。
- 如果工作空间委派无法在消息流中建模为独立 tool，只能退回普通 assistant 文本，停止并回到 `workflow-spec`。
- 如果 frontmatter 规范与现有工作空间设置页读写行为冲突，停止并回到 `workflow-spec` 明确兼容策略。

## 下一步

进入 `workflow-implement`。优先执行阶段 0 和阶段 1，把 frontmatter 规范与现有未提交实现对齐；随后再复核 slash payload、独立子会话和委派 tool 的端到端行为。

## 实现进度

- 已完成阶段 0：确认现有实现中主要偏差集中在 `AGENTS.md` 摘要解析仍读取中文正文“名称 / 描述”、`/init` 输出校验仍接受旧格式，以及内置 `/init` 尚未形成结构化发送闭环。
- 已完成阶段 1：`WorkspaceAgentService` 改为解析 `AGENTS.md` 顶部 YAML frontmatter 的 `name` / `description`；缺少 frontmatter 或字段时保持不可用；`WorkspaceInitService` 的生成提示、修复提示和写回前校验已改为 frontmatter 契约，旧中文字段仅作为迁移提示来源。
- 已完成阶段 2：sender payload 新增 `selectedBuiltinCommand`；项目工作空间作用域展示内置 `/init` 命令，对话作用域不展示；`/init` 可在无正文时发送；主进程收到 `/init` 后调用 `WorkspaceInitService.runInit` 并把结果写入普通消息流；旧磁盘版 init skill 不再创建，已存在的遗留 init skill 会从技能列表中过滤。
- 已复核阶段 3：当前委派路径会创建独立子会话，主会话写入 `workspace_delegate` tool call / result，tool result 包含 `childSessionId`、目标工作空间信息、状态和摘要，renderer 已注册工作空间委派卡片与跳转入口。
- 已复核阶段 4：显式选择工作空间 Agent 会作为结构化 payload 优先委派；对话作用域注入可用工作空间 Agent 摘要索引。自动路由当前仍以文本匹配为主，符合旧计划中的过渡状态，后续如需 LLM/tool 驱动自动路由应继续细化。
- 验证通过：`pnpm lint`、`pnpm build`、`pnpm exec tsgo --noEmit -p app/work/tsconfig.json`。
