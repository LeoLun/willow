# add-workspace-init-command 任务列表

## 1. 定义内置 `/init` 资源模型

- 为 slash 资源系统补充“内置命令”或等价资源类型
- 定义 `/init` 的展示信息、作用域和发送载荷结构
- 明确它不复用普通 `selectedSkills` 语义

## 2. 定义工作空间 Agent 摘要模型

- 定义从工作空间 `AGENTS.md` 顶部 YAML frontmatter 提取 `name`、`description` 的解析规则
- 定义旧正文中文“名称” / “描述”到 frontmatter 的迁移辅助规则，但不把它作为可自动调度的最终判定来源
- 定义工作空间 Agent 摘要的返回结构与可用性规则
- 明确缺失 frontmatter、`name` 或 `description` 时的降级行为

## 3. 接入作用域过滤与发现

- 在工作空间会话中暴露 `/init`
- 在 `conversation` 作用域中隐藏 `/init`
- 在对话作用域中暴露可用的工作空间 Agent 列表
- 为错误作用域下的执行增加保护与用户提示

## 4. 实现工作空间分析与 AGENTS.md 生成输入

- 读取当前工作空间根目录与已有 `AGENTS.md`
- 汇总工作空间名称、主要目录、工作空间技能和关键文件索引
- 组装稳定的初始化提示词，保留用户提供的整体结构并优化表达
- 确保最终 `AGENTS.md` 文本由 LLM 生成或重写，而不是仅靠本地模板拼接

## 5. 实现创建 / 改进写回逻辑

- 无 `AGENTS.md` 时创建新文件
- 有 `AGENTS.md` 时做结构化改进，保留有效约束
- 控制输出长度约 150 行，并校验 frontmatter `name` / `description` 完整

## 6. 接入对话主 Agent 的自动委派

- 在对话上下文中注入工作空间 Agent 摘要索引
- 定义主 Agent 自动选择子 Agent 的触发语义
- 定义显式指定优先于自动路由的规则

## 7. 实现独立子 Agent 会话编排

- 为工作空间委派建立独立子 Agent 运行实例，而不是仅切换主 Agent 的 `cwd`
- 定义主 Agent 与子 Agent 的任务输入、结果回传、停止和失败传播边界
- 定义子 Agent 的历史、运行状态与持久化记录边界
- 确保主会话只保留用户可理解的委派摘要，而不是混入完整子 Agent 原始历史
- 明确主 Agent 只接收子 Agent 的最终结果层回调，不消费其中间工具调用事件流

## 8. 将工作空间委派建模为 tool

- 定义专用工作空间委派 tool 的输入 / 输出结构
- 将每次委派渲染为独立 tool 调用消息
- 为该 tool 增加独立 renderer 和进行态 / 完成态 UI
- 在 tool 结果中保留子 Agent 会话 ID 与目标工作空间信息
- 支持点击 tool 卡片跳转到对应子 Agent 会话
- 限制 tool 结果只呈现最终摘要、失败原因或停止结论，不回显子 Agent 中间工具细节

## 9. 接入 UI 与结果反馈

- 在 slash 资源面板展示 `/init`
- 在对话 slash 资源面板展示由 `AGENTS.md` frontmatter 派生的工作空间 Agent
- 选择工作空间 Agent 后插入结构化引用，并随发送 payload 传给主进程
- 选择 `/init` 或工作空间 Agent 后触发对应专用执行分支
- 让 `/init` 的选择态、执行态和结果态尽量复用 skill invocation 的 UI 表现
- 向用户反馈“已创建”或“已改进”的结果

## 10. 验证

- 验证工作空间 / 对话作用域可见性正确
- 验证新建与改进两条路径
- 验证 `/init` 确实调用 LLM 而不是模板直出
- 验证生成内容包含 frontmatter `name` / `description`、技能索引、文件索引和触发说明
- 验证对话可读取工作空间 Agent 摘要，并在 `/` 资源面板展示
- 验证缺少 frontmatter 的 `AGENTS.md` 不会被自动路由为可用工作空间 Agent
- 验证自动调用与显式指定两条委派路径
- 验证委派确实创建独立子 Agent 会话，而不是只切换主 Agent 工作目录
- 验证委派在消息流中表现为独立 tool UI
- 验证点击该 tool UI 后可跳转到对应子 Agent 会话
- 验证主会话不会收到子 Agent 的中间工具调用和审批细节
- 验证子 Agent 的中间过程仅在子会话中可见
- 验证 `/init` 的 UI 表现与普通 skill 调用保持一致
- 运行相关检查，如 `pnpm lint` 与受影响模块的构建验证
