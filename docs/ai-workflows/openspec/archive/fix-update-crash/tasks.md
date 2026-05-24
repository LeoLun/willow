# 任务列表

## 1. 主进程服务层逻辑修复
- [ ] 修改 `app/work/src/main/service/update.service.ts`：
  - 重构 `startDownload()` 方法：
    - 引入对 backpressure (`drain` 事件) 的支持。
    - 在循环读取结束后，使用 `Promise` 包装并等待 `fileStream` 的 `finish` 事件，确保文件被完全刷入磁盘且文件句柄关闭。
    - 增加更完善的 `catch` 异常处理逻辑：中途报错时，调用 `fileStream.destroy()` 并异步删除损坏的临时文件 `this.tempFilePath`。
  - 重构 `installUpdate()` 方法：
    - 将 `fsPromises.rename` 操作包裹在支持跨设备转移的 fallback 逻辑中（捕获 `EXDEV` 错误时，使用 `fsPromises.copyFile` + `fsPromises.unlink` 代替）。
    - 确保备份 `app.asar` 至 `app.asar.old` 以及将临时文件移动为 `app.asar` 的操作均是安全的。

## 2. 验证与检查
- [ ] 在开发环境下运行项目，核实 `pnpm lint` 没有 oxlint 规则校验报错。
- [ ] 运行 `pnpm build` 确认项目正常打包与 TS 编译通过。
- [ ] 通过模拟测试或逻辑走查，确保 `UpdateService` 的写入流确实等待了 `finish` 事件。
