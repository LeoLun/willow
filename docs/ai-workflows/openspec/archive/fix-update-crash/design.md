# 架构与设计说明

## 详细设计

### 1. 异步写入流生命周期优化

在 `app/work/src/main/service/update.service.ts` 中，`startDownload` 的核心优化逻辑为：
- 利用 `Buffer.from(value)` 将流的 chunk 写入到 `fileStream`。
- 如果写入返回 `false`，说明缓冲区已满，需要监听 `drain` 事件以处理背压（Backpressure）。
- 当流读取完毕，调用 `fileStream.end()` 并通过 `Promise` 监听 `finish` 和 `error` 事件，确保所有缓冲区数据均已刷入硬盘中。
- 若中途发生异常，则显式调用 `fileStream.destroy()` 并使用 `fsPromises.unlink()` 删除已下载的临时文件，防止产生残留的损坏文件。

```typescript
      let downloadedBytes = 0;
      fileStream = createWriteStream(this.tempFilePath);

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          const chunk = Buffer.from(value);
          const isWritable = fileStream.write(chunk);
          if (!isWritable) {
            await new Promise<void>((resolve) => fileStream.once("drain", resolve));
          }
          downloadedBytes += chunk.length;
          const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          this.broadcastStatus("downloading", progress);
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
        fileStream.end();
      });
```

### 2. 跨设备文件重命名 Fallback 设计

在 `installUpdate` 中，通过捕获 `fsPromises.rename` 抛出的 `EXDEV` 错误来实现安全的跨磁盘/挂载点移动：

```typescript
async function safeMove(src: string, dest: string) {
  try {
    await fsPromises.rename(src, dest);
  } catch (err: any) {
    if (err.code === "EXDEV") {
      await fsPromises.copyFile(src, dest);
      await fsPromises.unlink(src);
    } else {
      throw err;
    }
  }
}
```

在 `installUpdate` 方法中，将两处 `fsPromises.rename` 替换为 safeMove 逻辑：
1. 备份当前的 `app.asar` 到 `app.asar.old`。
2. 将 `this.tempFilePath` 移动到 `app.asar`。
