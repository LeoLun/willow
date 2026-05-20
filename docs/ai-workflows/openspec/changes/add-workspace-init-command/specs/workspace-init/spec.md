# workspace-init Specification

## ADDED Requirements

### Requirement: `/init` Must Exist As A Workspace-Only Built-In Command

系统 MUST 提供一个内置 `/init` 能力，用于初始化当前项目工作空间的 `AGENTS.md`。

#### Scenario: Show `/init` inside a project workspace

- **前提** 当前会话绑定到一个项目工作空间
- **当** 用户打开 sender 的 slash 资源选择
- **那么** 系统显示 `/init`
- **并且** 该项带有说明，表明它会分析当前工作空间并创建或改进 `AGENTS.md`

#### Scenario: Hide `/init` inside conversation scope

- **前提** 当前会话处于 `conversation` 作用域
- **当** 用户打开 sender 的 slash 资源选择
- **那么** 系统不显示 `/init`
- **并且** 用户不能把 `/init` 当作对话作用域资源来调用

### Requirement: `/init` Must Analyze The Current Workspace Before Writing

系统 MUST 在执行 `/init` 时先分析当前工作空间，再决定创建或改进 `AGENTS.md`。

#### Scenario: Create a new AGENTS.md when missing

- **前提** 当前会话绑定到一个项目工作空间
- **并且** 工作空间根目录不存在 `AGENTS.md`
- **当** 用户执行 `/init`
- **那么** 系统分析工作空间名称、主要目录、工作空间技能和关键文件
- **并且** 在工作空间根目录创建新的 `AGENTS.md`

#### Scenario: Improve an existing AGENTS.md when present

- **前提** 当前会话绑定到一个项目工作空间
- **并且** 工作空间根目录已存在 `AGENTS.md`
- **当** 用户执行 `/init`
- **那么** 系统读取现有 `AGENTS.md` 并分析当前工作空间
- **并且** 在保留有效约束的前提下改进该文件，而不是盲目覆盖

### Requirement: `/init` Must Use LLM Generation Instead Of Template-Only Output

系统 MUST 通过一次真实的 LLM 生成或重写过程完成 `/init` 的最终 `AGENTS.md` 输出，而不是仅依赖本地模板拼接。

#### Scenario: Use analyzed workspace context as LLM input

- **前提** 用户在项目工作空间中执行 `/init`
- **当** 系统开始准备生成 `AGENTS.md`
- **那么** 系统可以先读取已有 `AGENTS.md`、工作空间技能和关键文件索引
- **并且** 将这些信息作为提示词或结构化上下文传给 LLM
- **并且** 最终写回的 `AGENTS.md` 文本来自该次 LLM 输出

#### Scenario: Do not satisfy `/init` with local template only

- **前提** 用户在项目工作空间中执行 `/init`
- **当** 系统完成 `AGENTS.md` 写回
- **那么** 系统不得只依赖硬编码模板或字符串拼接直接生成最终文本
- **并且** 必须存在一次真实的 LLM 参与生成或重写步骤

### Requirement: Generated AGENTS.md Must Follow The Workspace Template Contract

`/init` 生成或改进后的 `AGENTS.md` MUST 满足工作空间模板契约，并保留用户提供提示词的整体结构。

#### Scenario: Include required frontmatter

- **前提** `/init` 已完成 `AGENTS.md` 生成
- **当** 用户查看该文件
- **那么** 文件以 YAML frontmatter 开头
- **并且** frontmatter 包含 `name`
- **并且** frontmatter 包含 `description`
- **并且** `name` 和 `description` 可被对话作用域用于工作空间 Agent 发现与调度

#### Scenario: Include required workspace sections

- **前提** `/init` 已完成 `AGENTS.md` 生成
- **当** 用户查看该文件
- **那么** 文件包含工作空间名称
- **并且** 包含工作空间作用、拥有的技能、必须文件索引
- **并且** 正文可包含中文“名称”“描述”等面向人类阅读的说明，但不得替代 frontmatter `name` 与 `description`

#### Scenario: Describe trigger semantics explicitly

- **前提** `/init` 已完成 `AGENTS.md` 生成
- **当** 用户查看 frontmatter `description` 或正文触发说明
- **那么** 它明确说明何时触发
- **并且** 明确说明触发效果
- **并且** 明确这是对话功能调用该工作空间的主要触发机制

#### Scenario: Keep the output concise

- **前提** `/init` 已完成 `AGENTS.md` 生成
- **当** 系统完成最终写入
- **那么** 文件整体长度控制在约 150 行
- **并且** 不应退化为冗长的通用说明书

### Requirement: `/init` Must Preserve Workspace Boundary Errors

系统 MUST 在错误作用域下拒绝执行 `/init`，并返回清晰但简短的提示。

#### Scenario: Reject `/init` without a project workspace

- **前提** 当前执行上下文不是项目工作空间
- **当** 系统收到 `/init` 执行请求
- **那么** 系统拒绝执行
- **并且** 返回提示，说明 `/init` 只能在具体工作空间中使用

### Requirement: `/init` UI Must Feel Consistent With Skill Invocation

系统 MUST 让 `/init` 在 UI 上尽量复用普通 skill 调用的交互感知。

#### Scenario: Select `/init` through the same slash picker

- **前提** 当前会话绑定到一个项目工作空间
- **当** 用户打开 slash 资源选择器并选择 `/init`
- **那么** `/init` 与普通 skill 一样通过同一个资源面板被选择
- **并且** 不要求用户切换到单独的特殊入口

#### Scenario: Keep invocation feedback consistent with skills

- **前提** 用户已选择 `/init` 并发送当前消息
- **当** 系统开始执行 `/init`
- **那么** 输入区和消息区中的执行反馈路径与普通 skill 调用保持一致层级
- **并且** 结果通过普通消息流返回给用户
- **并且** 不应只使用旁路 toast 或静默写文件来替代正常调用反馈
