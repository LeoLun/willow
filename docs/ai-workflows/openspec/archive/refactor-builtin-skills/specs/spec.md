# refactor-builtin-skills Specification

## MODIFIED Requirements

### Requirement: `/init` (init skill) Must Be Passed To AI Agent For Execution

系统 MUST 停止拦截 `init` 技能，并将其作为普通技能发送给 AI Agent 执行。

#### Scenario: User triggers init skill in project workspace

- **前提** 当前会话绑定到一个项目工作空间
- **当** 用户选择内置技能 `init` 并点击发送
- **那么** 系统启动一个标准的 AI Agent 会话，将包含 `[$init](...)` 标签的消息发送给 AI
- **并且** AI Agent 根据系统提示词中的 `available_skills` 加载 `init/SKILL.md` 的内容
- **并且** AI Agent 自行调用工具读取工作空间文件，生成/改进 `AGENTS.md`
- **并且** AI Agent 自行执行 `ensure-frontmatter.js` 脚本为 `AGENTS.md` 添加 frontmatter
- **并且** AI Agent 向用户输出包含最终执行结果的答复

#### Scenario: No main process interception of init skill

- **前提** 任何会话作用域
- **当** 用户触发 `init` 技能
- **那么** 主进程中的 `SessionService` 不得拦截该请求，也不得调用 `WorkspaceInitService`
- **并且** 执行路径与普通技能（如 `workflow-spec`）完全相同

### Requirement: WorkspaceInitService Must Be Retired

主进程中的 `WorkspaceInitService` 必须彻底废弃并移除。

#### Scenario: Remove files and registration

- **前提** 编译运行系统
- **当** 系统加载启动时
- **那么** `app/work/src/main/service/workspace-init.service.ts` 文件已被删除
- **并且** `AppModule` 及其它组件中不再引入、注册或注入 `WorkspaceInitService`
- **并且** 系统编译正常通过，运行无异常
