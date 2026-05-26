# 对话工作目录修改规范

## 需求

### R1: 默认路径变更

系统创建“对话”工作区时，其物理根目录路径 MUST 为：
- `join(app.getPath("userData"), "conversation")`

不再使用 `join(app.getPath("home"), ".willow")` 作为新对话工作区的默认路径。

### R2: 自动迁移机制

为了向后兼容且不丢失历史对话在 `~/.willow` 中生成的 Artifacts、代码文件等：
- 当系统启动或加载工作区列表（调用 `getOrCreateConversationWorkspace`）时：
  1. 如果数据库中存在 kind 为 `conversation` 且 `path` 指向 `~/.willow`（或以 `~/.willow` 开头）的记录：
     - 如果物理上 `~/.willow` 目录存在，而新的 `userData/conversation` 目录不存在，系统 MUST 自动将整个 `~/.willow` 目录移动（重命名）或复制到新路径。
     - 系统 MUST 将数据库中该工作区的 `path` 字段更新为新路径 `join(app.getPath("userData"), "conversation")`。
     - 如果移动成功或旧目录已不存在，则确保新目录已被创建。

### R3: 稳定性与容错

- 迁移过程中如果发生文件系统错误（例如无权限或路径被占用），系统 MUST 能够优雅降级或捕获错误，确保应用不崩溃，并在重试/下次启动时可以继续安全初始化。
- 迁移操作只在检测到旧路径存在且新路径不存在时执行一次。

## 验收标准

- [ ] 首次全新启动应用（无旧数据）时，创建的对话工作空间对应的物理路径为 `<userData>/conversation`。
- [ ] 存在历史 `~/.willow` 目录且数据库中 conversation 记录指向 `~/.willow` 时，启动应用后：
  - 数据库中该记录的 `path` 被更新为 `<userData>/conversation`。
  - 物理文件成功迁移到 `<userData>/conversation` 目录下。
  - 历史的 `~/.willow` 目录已被安全迁移（重命名或清空/删除）。
