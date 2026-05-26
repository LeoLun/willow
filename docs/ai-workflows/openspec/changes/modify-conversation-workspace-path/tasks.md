# 任务列表

## 1. 物理目录搬迁辅助函数实现
- [x] 在 `WorkspaceService` 中实现一个稳健的目录移动方法 `moveDirectory(src, dest)`，支持跨分区 EXDEV 降级复制。
- [x] 确保在移动过程中捕获所有异常并输出日志，避免程序崩溃。

## 2. 修改 WorkspaceService 中的路径与迁移逻辑
- [x] 修改 `WorkspaceService.getOrCreateConversationWorkspace` 方法。
- [x] 在查找现有 `conversation` 记录后，对比其路径是否包含 `.willow`。
- [x] 若为旧路径且旧目录存在、新目录不存在，触发 `moveDirectory` 物理迁移。
- [x] 在数据库中更新 `conversation` 工作空间的 `path` 字段为 `join(app.getPath("userData"), "conversation")`。
- [x] 如果是全新用户（无任何记录），直接以 `join(app.getPath("userData"), "conversation")` 创建记录并创建对应物理目录。

## 3. 回归与编译验证
- [x] 运行 `pnpm lint` 检查代码规范。
- [x] 运行 `pnpm build` 确认项目编译正常。
- [x] 手动验证：
  - 测试 1：全新启动，验证对话工作目录生成在 `userData/conversation` 下。
  - 测试 2：在 `~/.willow` 下放入测试文件并启动，验证启动后文件被成功移到 `userData/conversation` 且 `~/.willow` 被清理。
