# 2026-05-24-fix-update-crash 执行计划

本计划为修复 Willow 桌面端应用增量更新重启后直接崩溃的实施计划，基于 `docs/ai-workflows/openspec/changes/fix-update-crash/`。

## 1. 任务划分与时序

### 阶段一：主进程 `UpdateService` 的 `startDownload()` 重构
- 目标：确保流数据完全写入磁盘，处理背压，并在 `'finish'` 事件触发后返回，避免提前通知下载成功。
- 修改文件：`app/work/src/main/service/update.service.ts` -> `startDownload` 方法。
- 逻辑要点：
  - 监听 `drain` 事件，防止缓冲溢出。
  - 用 `Promise` 等待整个文件写入流的 `finish` 事件。
  - 在 `catch` 异常分支中，如果写入流异常，显式调用 `fileStream.destroy()`，并异步调用 `fsPromises.unlink(this.tempFilePath)` 以删除损坏的临时文件。

### 阶段二：主进程 `UpdateService` 的 `installUpdate()` 跨设备容错
- 目标：处理 `fsPromises.rename` 在跨设备/分区时抛出的 `EXDEV` 错误。
- 修改文件：`app/work/src/main/service/update.service.ts` -> `installUpdate` 方法。
- 逻辑要点：
  - 实现 `safeMove(src, dest)` 容错助手函数。
  - 将 `fsPromises.rename` 操作（备份和替换 asar）替换为 `safeMove`，即捕获 `EXDEV` 时降级执行 `fsPromises.copyFile` + `fsPromises.unlink`。

## 2. 静态检查与验证

- 执行 `pnpm lint` 确保没有 oxlint 错误。
- 执行 `pnpm build` 确保 TypeScript 编译成功。
- 在开发环境下（模拟模式下）运行 `pnpm dev` 验证更新检查、下载和重启的模拟流程不会报错。
