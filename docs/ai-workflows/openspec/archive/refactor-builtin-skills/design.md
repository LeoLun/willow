# refactor-builtin-skills 设计文档

## 背景

Willow 的技能加载机制已经支持加载内置技能（Built-in Skills），如 `init`、`workflow-spec`、`workflow-worktree` 等。

在之前的实现中，为了尽快交付 `/init` 功能，主进程通过 `session.service.ts` 对 `init` 技能进行了拦截。拦截后，主进程构造了硬编码的 Prompt，并调用独立的 `WorkspaceInitService` 使用单轮 LLM 服务（`agentService.generateSingleTurnText`）在后台拼接生成并写回了 `AGENTS.md`。

这种处理方式存在以下弊端：
1. **执行模式不一致**：内置技能 `init` 与其他内置技能（如 `workflow-spec`）在执行上分裂为两条截然不同的路径：`init` 走主进程硬编码拼接，而 `workflow-*` 技能走普通的 AI Agent 工具调用流程。
2. **逻辑重复**：随着 `init` 技能自身的 `SKILL.md` 和 `ensure-frontmatter.js` 的完善，AI Agent 完全有能力通过自身的 `read`（读取工作空间关键文件）、`write`（写 `AGENTS.md`）和 `command`/`bash`（运行 frontmatter 确保脚本）工具，端到端地按照 `SKILL.md` 自行执行初始化，无需主进程越俎代庖。

因此，本次重构的核心设计是**取消拦截，将 `init` 技能的执行链路完全回归为普通的 AI Agent 技能执行流**。

## 详细设计

### 1. 移除拦截点与代写服务

在主进程中，做以下清理：

- **移除 session.service.ts 中的拦截**：
  在 `SessionService.sendMessage` 方法中，移除 `isInitCommand` 相关的判断（不检查 `selectedBuiltinCommand` 也不检查 `selectedSkills` 中的 `init`），让消息自然走 `executeAgentSession` 进入 AI Agent 会话。
  
- **删除 executeWorkspaceInitCommand 方法**：
  该方法中的消息模拟和手动创建/更新 `AGENTS.md` 逻辑将彻底不再需要，直接从 `SessionService` 中移除。

- **彻底废弃 WorkspaceInitService**：
  删除 `app/work/src/main/service/workspace-init.service.ts` 文件。
  从 `app/work/src/main/app.module.ts` 中移除它的 providers 注册。

### 2. 技能的普通加载与呈现

- `SkillService.getAvailableSkills` 中已经可以扫描内置技能目录。
- `init` 技能的 `SKILL.md` 位于 `app/work/builtin-skills/init/SKILL.md`。
- `SkillService` 返回的 `init` 技能具有以下属性：
  ```json
  {
    "name": "init",
    "description": "分析当前工作空间并创建或改进 AGENTS.md，完成工作空间 Agent 元信息初始化。",
    "filePath": ".../builtin-skills/init/SKILL.md",
    "scope": "workspace",
    "scopeLabel": "内置"
  }
  ```
- 前端 `SenderContainer.vue` 正常向 `getAvailableSkills` 请求获取可用技能并渲染在 slash 选择器中。
- 用户在选择并发送 `init` 技能时，输入框内以 `[$init](filePath)` 标记呈现。发送后，此文本照常作为 message 传给后台。

### 3. AI Agent 对技能的端到端执行

由于 `init` 技能的文件位置已被注入到 system prompt 的 `<available_skills>` 块中，AI Agent 在接收到用户的 `/init` 或包含该技能的消息时，执行流如下：
1. **发现与读取**：AI 发现用户消息中指定或匹配了 `init` 技能，通过 `read` 工具读取 `app/work/builtin-skills/init/SKILL.md`，理解其具体步骤。
2. **分析工作空间**：AI 根据 `SKILL.md` 的指示，使用 `read` / `find` 等工具扫描工作空间根目录下的 `package.json`、`README.md` 等。
3. **写入/优化 AGENTS.md**：AI 使用 `write` 工具（或在已有 `AGENTS.md` 时使用 `edit` 工具）在工作空间根目录下生成或修改 `AGENTS.md` 文件。
4. **运行 Frontmatter 脚本**：AI 探测到需要进行 frontmatter 校准，调用 `command`/`bash` 工具，运行 `node <技能路径>/scripts/ensure-frontmatter.js <AGENTS.md 绝对路径> <name> <description>` 脚本。
5. **返回答复**：任务完成后，AI 向用户输出确认答复。

该设计能实现逻辑的最简化，使内置技能的执行表现与普通工作空间或全局技能完美一致，免去主进程多余的业务代写逻辑。

## 验证设计

### 编译与构建
- 在重构完成后，使用 `pnpm build` 和 `pnpm lint` 确保主进程在删除 `WorkspaceInitService` 相关的代码后依然没有编译和类型错误。

### 手动流程测试
- 进入项目工作空间会话，输入 `/` 选择 `init` 并发送。
- 确认 AI Agent 启动并在流式生成中，调用 `read`、`write` 以及执行脚本命令行工具。
- 验证生成的 `AGENTS.md` 符合 frontmatter 和正文格式规范。
