# 设计文档：修改对话的工作目录

## 架构设计

### 1. 路径生成规则

对话工作区的路径统一由 `WorkspaceService.getOrCreateConversationWorkspace()` 计算和生成：
- 旧路径：`join(app.getPath("home"), ".willow")`
- 新路径：`join(app.getPath("userData"), "conversation")`

### 2. 自动迁移时机与步骤

在 `WorkspaceService.getOrCreateConversationWorkspace()` 内部执行以下迁移步骤：

1. **获取已有记录**：通过 `this.workspaceDao.findFirstByKind("conversation")` 查找现有的对话工作空间。
2. **检测与物理迁移**：
   - 如果存在已有记录：
     - 获取其 `existingPath`。
     - 如果 `existingPath` 包含 `.willow`（如以 `~/.willow` 或 `homedir()/.willow` 结尾），表明是旧路径。
     - 如果新路径 `join(app.getPath("userData"), "conversation")` 还不存在，且旧路径 `existingPath` 在物理上存在：
       - 使用 `fs.promises.rename` 或复制后删除的方式，将 `existingPath` 移动到新路径。
       - 迁移完成后，更新数据库记录：`this.workspaceDao.update(existing.id, { path: newPath })`。
     - 如果新路径已存在或旧路径不存在，但数据库中记录依然是旧路径：
       - 直接更新数据库记录：`this.workspaceDao.update(existing.id, { path: newPath })`。
3. **安全创建目录**：
   - 确保新路径的目录已被递归创建 `await mkdir(newPath, { recursive: true })`。

### 3. 文件系统移动操作辅助

在 Node.js 中，跨分区的 `fs.promises.rename` 可能会失败。由于我们在同个用户目录下（从 `~/.willow` 移动到 `~/Library/Application Support/com.willow.work/conversation`），通常在同一个分区，`rename` 是安全的。但为了确保鲁棒性，如果 `rename` 抛出 `EXDEV`（cross-device link）错误，我们可以捕获它并回退到复制文件后删除旧目录的逻辑。

```typescript
import { rename, mkdir, stat } from "node:fs/promises";

async function safeMoveDir(src: string, dest: string) {
  try {
    await rename(src, dest);
  } catch (err: any) {
    if (err.code === "EXDEV") {
      // 跨分区复制逻辑
      await copyDir(src, dest);
      await rm(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}
```
由于对话工作空间通常包含较少且较小的临时文件，此迁移操作会非常迅速。
