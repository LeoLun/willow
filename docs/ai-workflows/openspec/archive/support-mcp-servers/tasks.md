# 任务列表

## 1. 全局技能路径修改
- [ ] 修改 `packages/core/src/skills.ts` 中的 `loadSkills`，将全局路径 `agentDir` 修改为指向 `~/.willow`。

## 2. MCP 存储层 (Storage)
- [ ] 编写 JSON 配置读写逻辑，支持 `~/.willow/mcp.json` 与 `<workspacePath>/.mcp.json`。

## 3. 主进程服务与 IPC 实现
- [ ] 新建 `McpServerService` 负责 MCP 进程/连接管理。
- [ ] 增加对应的 IPC 路由控制器。

## 4. 工具集成
- [ ] 动态加载活跃 MCP 工具并包装，通过 `AgentService` 注入至 Agent 运行时。

## 5. 前端 UI
- [ ] 实现全局/工作空间 MCP 配置管理界面及表单 Dialog。

## 6. 验证
- [ ] 验证全局技能已从 `~/.willow/skills` 加载。
- [ ] 验证 MCP 服务的工具可被正确调用。
