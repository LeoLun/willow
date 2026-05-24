# OpenSpec Proposal: 修复增量更新重启后直接崩溃问题

## 动机

在 Willow 桌面应用中，增量更新（替换 `app.asar`）在完成下载并点击“重启并更新”后，会导致新启动的应用直接崩溃，并报错 `SIGTRAP (Trace/BPT trap: 5)`，崩溃栈指向 `ares_dns_rr_get_name` (偏移量大，实为符号剥离导致的偏离)、`node::loader::ModuleWrap` 以及 `v8` 部分逻辑。

此问题的根本原因在于：
1. **异步写入流未等待完成**：在主进程 `UpdateService.ts` 的 `startDownload()` 中，调用了 `fileStream.end()` 后便立即广播了 `downloaded` 状态，并返回了 `{ success: true }`。由于 `fileStream.end()` 是异步的，调用时数据可能还在缓存区或尚未完全写入磁盘，更没有等待文件流的 `finish` 或 `close` 事件。
2. **提前执行文件替换与重启**：当渲染进程收到下载完成的通知后，立即触发了 `installUpdate()`。由于底层写入尚未真正完成，`installUpdate()` 依然调用 `fsPromises.rename()` 将未完全写完的 `app.asar.tmp` 重命名为 `app.asar`。
3. **加载损坏的 Asar 文件导致崩溃**：在极短的时间内，`app.relaunch()` 启动了新的 Electron 实例，而新的实例在启动并加载该 `app.asar` 时，读取到了一个尚未写完、不完整或损坏的 ASAR 文件，从而导致 Node/V8 引擎解析/加载模块时发生严重错误并直接 Crash。
4. **跨设备 Rename 潜在失败**：如果临时目录与应用资源目录在不同的磁盘分区或挂载点，`fsPromises.rename` 将会由于跨设备限制抛出 `EXDEV` 错误。

因此，需要通过优化文件写入流的生命周期控制、等待流完全关闭、以及为重命名提供跨设备兼容性机制，来彻底修复该崩溃问题。

## 目标

1. **等待文件写入完全结束**：修改 `UpdateService.ts` 的 `startDownload` 方法，使用 `Promise` 包装并在写入流的 `finish` 事件触发后再返回下载成功。
2. **健全的写入流错误与内存清理**：在下载失败或发生异常时，确保及时释放 `reader`、销毁 `fileStream` 并清理不完整的临时文件。
3. **跨设备文件替换兼容**：在 `installUpdate` 中处理 `fsPromises.rename` 可能会抛出的 `EXDEV`（跨设备链接）错误，提供 `copyFile` + `unlink` 作为 Fallback 方案。

## 范围

- **主进程 `UpdateService.ts`**：
  - 在 `startDownload()` 方法中，将流 the 写入和关闭逻辑改为基于 `Promise` 的等待机制，在 `finish` 事件后 resolve。
  - 在 `startDownload()` 的 `catch` 块中，添加流关闭与已下载临时文件的清理逻辑。
  - 在 `installUpdate()` 中，增加 `EXDEV` 错误的处理，并使用 `copyFile` 与 `unlink` 处理跨分区移动。

## 非范围

- 重构整个自动更新流程。
- 整包更新（DMG）的安装逻辑优化。
