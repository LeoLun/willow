# 2026-05-26-modify-conversation-workspace-path 执行计划

## 目标

按照 `modify-conversation-workspace-path` OpenSpec，将对话的工作目录从 `~/.willow` 移动到应用的 `userData/conversation` 目录下，并实现平滑的数据迁移与数据库更新。

## 执行切片

```text
阶段 1：在 WorkspaceService 中实现目录递归移动与降级复制方法
阶段 2：修改 getOrCreateConversationWorkspace 实现迁移和数据库更新逻辑
阶段 3：代码编译与 Lint 检查
阶段 4：手动测试与收尾
```

---

## 阶段 1：在 WorkspaceService 中实现目录递归移动与降级复制方法

### 涉及文件
- `app/work/src/main/service/workspace.service.ts`

### 实施步骤
1. 在 `WorkspaceService` 类中新增私有辅助方法 `moveDirectory(src: string, dest: string): Promise<void>`。
2. 方法逻辑：
   - 首先尝试使用 `fs.promises.rename(src, dest)` 进行重命名（同分区下最快）。
   - 若捕获到 `EXDEV`（跨设备/跨分区）错误或其他可恢复的系统错误，回退到使用 `fs.promises.cp(src, dest, { recursive: true })` 进行复制，然后再使用 `fs.promises.rm(src, { recursive: true, force: true })` 清理旧目录。

---

## 阶段 2：修改 getOrCreateConversationWorkspace 实现迁移和数据库更新逻辑

### 涉及文件
- `app/work/src/main/service/workspace.service.ts`

### 实施步骤
1. 修改 `getOrCreateConversationWorkspace()`：
   - 定义新路径 `newPath = join(app.getPath("userData"), "conversation")`。
   - 获取已有 `conversation` 类型的数据库记录 `existing`。
   - 如果不存在已有的数据库记录，直接在数据库插入以 `newPath` 为路径的 `conversation` 工作区记录，并递归创建该目录。
   - 如果已存在记录，判断其 `existing.path`：
     - 若 `existing.path` 指向 `~/.willow`（如包含 `.willow` 文件夹）：
       - 如果物理上 `existing.path` 存在，且 `newPath` 不存在，则调用第一阶段实现的 `moveDirectory(existing.path, newPath)` 进行物理文件迁移。
       - 更新数据库记录的 `path` 字段为 `newPath`。
       - 返回更新后的记录。
     - 若旧路径不存在或新路径已存在，但数据库仍指向旧路径，则直接更新数据库记录的 `path` 字段为 `newPath`。
     - 若一切正常，确保 `newPath` 目录已被创建，并返回该记录。

---

## 阶段 3：代码编译与 Lint 检查

### 实施步骤
1. 运行 `pnpm lint` 检查代码风格与错误。
2. 运行 `pnpm build` 或在 `app/work` 中执行构建，确保 TypeScript 类型无报错。

---

## 阶段 4：手动测试与收尾

### 实施步骤
1. 确认没有历史遗留的 `.willow` 目录。
2. 启动应用：`pnpm dev`。
3. 检查控制台及系统 `appData`（如 `~/Library/Application Support/com.willow.work-dev`），确认已自动生成 `conversation` 文件夹。
4. 停止应用。
5. 手动创建一个测试用的旧目录 `~/.willow`，并在其中放入一些测试文件（例如 `test.txt`）。
6. 将 SQLite 数据库中已有的 `conversation` 工作空间记录的 `path` 字段改回 `~/.willow`（可通过重新触发数据库插入或临时在代码里模拟）。
7. 启动应用，验证控制台输出，确认 `test.txt` 已被迁移至新的 `userData/conversation` 目录下，且 `~/.willow` 已被成功清理。

---

## 验证命令

```bash
pnpm lint
pnpm build
```

## 下一步

进入 `workflow-implement` 阶段。
