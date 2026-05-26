# Proposal: 修改对话的工作目录

## 动机

当前“对话”模式（即不绑定项目目录的系统级对话工作区）的根目录被设置为用户主目录下的 `~/.willow`。这导致用户的个人主目录下会产生一个应用特定的隐藏文件夹，不够整洁。为了让应用更符合操作系统的应用数据隔离规范，我们需要将对话的工作目录从 `~/.willow` 移动到应用的 `userData` 路径下（即 `<userData>/conversation` 目录下），使应用的数据存储更加聚合和安全。

## 目标

1. **修改对话工作空间路径**：将新建的对话工作空间（kind 为 `conversation`）的路径修改为 `join(app.getPath("userData"), "conversation")`。
2. **实现数据平滑迁移**：若用户已经存在 `~/.willow` 目录且数据库中已有对应的 conversation 工作空间记录，应在应用启动或获取工作空间列表时，自动将 `~/.willow` 目录下的内容搬迁到 `userData` 下的新位置，并更新数据库中的 `path` 记录。

## 范围

- `WorkspaceService.getOrCreateConversationWorkspace` 逻辑：修改默认路径计算规则，增加路径数据库迁移与物理文件迁移逻辑。
- 物理迁移处理：当旧目录 `~/.willow` 存在且新目录不存在时，自动将旧目录重命名或复制移动到新目录，并确保目录创建成功。
- 处理数据库迁移：如果数据库中已存在的 `conversation` 工作空间的 `path` 指向 `~/.willow`，则自动将其更新为新路径。

## 非范围

- 不更改全局的 MCP 服务配置文件位置（如 `~/.willow/mcp.json`，若有需要未来另行讨论）。
- 不更改全局技能加载路径逻辑（如有必要，保持 `loadSkills` 中的 fallback 为 `~/.willow`）。

---
