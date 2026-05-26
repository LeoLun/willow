# Specification: MCP 服务配置与全局技能加载规格

## 1. 全局技能加载规格
- 全局技能加载路径锁定为 `~/.willow/skills`。
- 如果该目录不存在，`loadSkills` 阶段应友好地忽略该目录并返回空数组，而不是抛出异常。

## 2. MCP 配置规格
- 全局 MCP 配置文件路径：`~/.willow/mcp.json`。
- 工作空间 MCP 配置文件路径：`<workspacePath>/.mcp.json`。
- 字段校验与写入规范：
  - 必须支持 stdio 与 sse 两种类型。
  - 主进程建立连接失败时不应导致整个 AI 会话中断。
  - 为防止工具重名冲突，最终注册工具名为 `mcp__${serverName}__${mcp_tool}`。
