# support-mcp-servers 执行计划

## 目标

按 `support-mcp-servers` OpenSpec 落地完整的 MCP 服务支持能力，并统一全局技能加载路径：

1. **全局技能路径调整**：将全局技能（Global Skills）加载路径变更为 `~/.willow/skills`。
2. **MCP 配置管理 (JSON)**：
   - 全局配置存储在 `~/.willow/mcp.json`。
   - 工作空间配置存储在工作空间根目录的 `.mcp.json`。
3. **主进程 MCP 客户端与服务**：实现 `McpServerService` 负责 stdio 子进程与 SSE 客户端的生命周期管理，列出工具并代理执行。
4. **工具集成**：在 `AgentService` 创建默认 Agent 时，动态连接活跃 MCP 服务并将其工具包装注入 Agent 运行时。
5. **配置 UI 界面**：添加全局设置和工作空间设置中的 MCP 配置展示、添加、编辑、删除与启停开关。

## 执行切片

```text
阶段 1：修改全局技能加载路径
阶段 2：实现 JSON 存储读写模块与 McpServerService
阶段 3：实现 stdio 与 sse 客户端连接与工具列表获取
阶段 4：实现 MCP 工具的动态包装与 CoreAgent 的注入
阶段 5：主进程 IPC 控制器与路由注册
阶段 6：开发前端 UI (全局设置与工作空间设置) 与联调
阶段 7：回归验证与收尾
```

---

## 阶段 1：修改全局技能加载路径

### 涉及文件
- `packages/core/src/skills.ts`

### 实施步骤
1. 修改 `loadSkills` 里的 `agentDir` 锁定到 `join(homedir(), ".willow")`，不再依赖 `options.userData`。
2. 确保目录缺失时友好处理。

### 验证
- 创建 `~/.willow/skills/my-test-skill/SKILL.md`，启动项目验证该技能可以被成功加载。

---

## 阶段 2：实现 JSON 存储读写模块与 McpServerService

### 涉及文件
- 新增 `app/work/src/main/service/mcp-server.service.ts`
- 新增相关类型定义于 `app/work/src/shared/api.ts`

### 实施步骤
1. 定义 MCP 服务器的配置类型（与 Claude Desktop 规范兼容）。
2. 在 `McpServerService` 中实现全局 `mcp.json` 的读取与写入。
3. 实现工作空间 `.mcp.json` 的读取与写入。

### 验证
- 单元测试或辅助脚本测试读写功能。

---

## 阶段 3：实现 stdio 与 sse 客户端连接与工具列表获取

### 涉及文件
- `app/work/src/main/service/mcp-server.service.ts`

### 实施步骤
1. 利用 `child_process.spawn` 实现 stdio 连接客户端（接收 command, args, env 启动子进程，利用标准输入输出进行 JSON-RPC 2.0 交互）。
2. 实现 sse 客户端连接（使用 EventSource/HTTP 交互）。
3. 实现心跳机制与异常重连。
4. 获取每个激活客户端的工具列表 (`tools/list` 请求)。

---

## 阶段 4：实现 MCP 工具的动态包装与 CoreAgent 的注入

### 涉及文件
- `packages/core/src/tools/index.ts`
- `app/work/src/main/service/agent.service.ts`

### 实施步骤
1. 将 MCP 协议返回的 JSON Schema 工具参数动态映射为 CoreAgent 运行时能消费的格式（或通过包装器进行动态验证）。
2. 为防止命名冲突，使用 `mcp__${serverName}__${mcp_tool}` 进行唯一命名。
3. 代理工具调用逻辑：当 AI 调用 MCP 工具时，将调用参数传递回 `McpServerService`，由其转发给对应 MCP 客户端，并获得输出。

---

## 阶段 5：主进程 IPC 控制器与路由注册

### 涉及文件
- 新建相关 controller 在 `app/work/src/main/controllers/mcp/`
- 在 `app.module.ts` 中注册 `McpServerService` 与控制器

### 实施步骤
1. 新建 `get.mcp.servers.ts`, `add.mcp.server.ts`, `update.mcp.server.ts`, `delete.mcp.server.ts`, `toggle.mcp.server.ts` 等控制器。
2. 绑定对应的 IPC 常量。

---

## 阶段 6：开发前端 UI (全局设置与工作空间设置) 与联调

### 涉及文件
- `app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue` (或新增 MCP 专属子 tab)
- `app/work/src/renderer/src/pages/chat/workspace/Workspace.vue` (或 workspace 设置部分)
- 新建 MCP 管理组件和 Form Dialog

### 实施步骤
1. 在全局设置中加入 MCP 服务配置列表。
2. 在工作空间设置中加入工作空间特定的配置列表。
3. 实现添加/编辑表单（支持 stdio 命令行、参数、环境变量和 sse URL 输入）。
4. 联调获取、保存、切换启停等功能。

---

## 阶段 7：回归验证与收尾

### 实施步骤
1. 验证修改后的全局技能加载正常。
2. 添加一个测试 stdio MCP 服务，验证工具列表被成功加载到 AI 输入上下文，且 AI 调用工具时能获得子进程的正确回复。
3. 运行项目编译与代码检查：
   - `pnpm lint`
   - `pnpm build`

---

## 验证命令

```bash
pnpm lint
pnpm build
```

## 下一步
进入 `workflow-implement` 阶段，准备分支并开始实现。
