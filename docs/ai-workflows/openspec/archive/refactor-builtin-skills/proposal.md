# refactor-builtin-skills

## 摘要

将内置技能（包括 `init`、`workflow-spec`、`workflow-worktree` 等）的执行逻辑完全移交给 AI Agent 执行，取消在主进程中的拦截与特殊处理逻辑，实现所有技能执行链路的完全统一。

## 问题

先前，在 `/init` 被定义为内置命令的阶段，主进程在 `session.service.ts` 中通过拦截 `init` 命令或 `init` 技能，通过 `WorkspaceInitService` 独立且静默地完成了 `AGENTS.md` 的生成。

这导致了两个问题：
1. **链路分裂**：内置技能 `init` 与其他内置技能（如 `workflow-spec` 等）的运行路径不一致。普通和内置技能是由 AI Agent 读取 `SKILL.md` 并使用工具链自主执行，而 `init` 却是主进程代为执行。
2. **逻辑冗余**：随着内置技能 `init` 目录中 `SKILL.md` 和 `ensure-frontmatter.js` 的完善，AI Agent 完全有能力通过 `read`（读取工作空间关键文件）、`write`（写 `AGENTS.md`）和 `command`（执行 frontmatter 脚本）独立且弹性地完成初始化工作，不再需要主进程专门代写代码。

因此，我们需要取消主进程对 `init` 命令/技能的拦截，彻底解耦该硬编码。

## 目标

1. **统一技能执行**：将 `init` 技能彻底作为一个普通技能发送给 AI Agent 执行。AI Agent 在会话中通过 `read` 工具读取 `init/SKILL.md` 以获知具体初始化步骤，随后自主在工作空间中完成 `AGENTS.md` 的生成，并调用 terminal 运行 `ensure-frontmatter.js` 脚本。
2. **清理拦截硬编码**：移除 `session.service.ts` 中对 `init` 的检测（`isInitCommand` 逻辑）与专属执行方法（`executeWorkspaceInitCommand`）。
3. **废弃主进程代写服务**：完全删除主进程的 `WorkspaceInitService` 服务及其对应的模块注册。
4. **保留环境安全报错**：当用户在非项目工作空间（如对话工作空间）中选用并发送 `init` 技能时，在 prompt 层面由 AI Agent 判断或利用其 instructions 进行合理报错或拦截，而不是在主进程拦截。

## 非目标

- 本次重构不修改前端技能加载、选择及 UI 显示的通用代码。
- 本次重构不改变其它内置技能（如 `workflow-spec`）的功能定义。

## 成功标准

- 在项目工作空间下，用户可以通过 `/` 选择内置技能 `init` 并发送。
- 发送后，AI Agent 的会话流正常建立，不走主进程静默生成逻辑。
- AI Agent 能够通过调用 `read`、`write` 工具对工作空间中的文件进行分析并生成或修改 `AGENTS.md`，随后调用 terminal 工具执行 `node <技能路径>/scripts/ensure-frontmatter.js ...`，最终输出任务完成的回复。
- 在非项目工作空间下（如对话空间），选用 `init` 时，AI 能够由于技能前置条件限制返回拒绝执行的提示，或者由 AI Agent 根据限制进行处理。
- `app/work/src/main/service/workspace-init.service.ts` 文件被彻底删除，并且主进程无编译或运行错误。

## 推荐方案

**方案：彻底删除主进程拦截层，交给 AI 按照 SKILL.md 进行端到端执行**

- 移除 `session.service.ts` 中的拦截点。
- 彻底移除 `WorkspaceInitService` 及其依赖项。
- 依靠 `init/SKILL.md` 已有的具体指南，引导 AI 自行探测目录、生成文件，并调用 `ensure-frontmatter.js` 进行 frontmatter 的注入与校准。

## 下一步

编写详细需求 Spec 及任务列表，准备进入 worktree 及实现阶段。
