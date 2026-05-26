# Proposal: 支持 MCP 服务 与全局技能加载路径调整

## 动机

Model Context Protocol (MCP) 是一个开放的标准协议，使 AI 模型能够安全、一致地访问各种外部数据源和工具。当前 Willow 系统内置的工具和技能是静态且硬编码的。

为了极大地扩展 Willow 的功能生态，允许用户使用社区中丰富的 MCP 服务，我们需要让 Willow 支持配置并运行 MCP 服务。用户可以根据需要，在全球范围内（Global）或者特定工作空间（Workspace）内添加 stdio 和 sse 类型的 MCP 服务。

同时，为了使全局的配置与扩展路径更加统一，我们需要将原有的全局技能（Global Skills）加载路径从 `~/.agents/skills`（或 `userData` 下的路径）统一迁移到全局用户配置文件夹 `~/.willow/skills` 下。这有利于未来配置文件的统一打包与备份。

## 目标

1. **多层级配置**：支持在全局配置或工作空间配置中添加、编辑、删除和开启/关闭 MCP 服务。
2. **多协议适配**：支持 Stdio (子进程) 和 SSE (HTTP Web-socket / EventSource) 传输协议的 MCP 客户端。
3. **全局技能路径调整**：全局技能的查找与加载根目录调整为 `~/.willow/skills/`。
4. **动态工具加载与代理**：会话启动时，动态查询并建立与相应活跃 MCP 服务的连接，读取其暴露的工具并注册进 Agent 运行时以供调用。

## 范围

- **持久化层**：
  - MCP 服务配置：全局在 `~/.willow/mcp.json`，工作空间在 `workspacePath/.mcp.json`。
  - 全局技能加载：从 `~/.willow/skills` 读取。
- **主进程服务端**：
  - MCP 连接管理器与客户端。
- **共享与 Core 层**：
  - 修改 `packages/core/src/skills.ts` 中的 `loadSkills`，使默认全局 `agentDir` 为 `~/.willow`。
- **渲染进程 (UI)**：
  - 提供全局和工作空间 MCP 管理界面。
