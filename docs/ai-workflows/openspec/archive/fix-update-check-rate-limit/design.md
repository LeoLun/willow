# 架构与设计说明

## 详细设计

### 1. 主进程 `UpdateService` 的缓存和 User-Agent 逻辑

在 `app/work/src/main/service/update.service.ts` 中：

```typescript
// 新增私有成员变量
private lastCheckTime = 0;
private cachedCheckResult: CheckUpdateResponse | null = null;

// 修改 checkUpdate 方法定义
async checkUpdate(force = false): Promise<CheckUpdateResponse> {
  const now = Date.now();
  // 10 分钟缓存期（600,000 毫秒）
  if (!force && this.cachedCheckResult && now - this.lastCheckTime < 10 * 60 * 1000) {
    console.log("[UpdateService] 使用缓存的更新检查结果");
    // 同步更新服务自身的状态，以确保 UI 监听的状态机是正确的
    if (this.cachedCheckResult.hasUpdate) {
      this.status = "available";
    } else {
      this.status = "idle";
    }
    return this.cachedCheckResult;
  }

  this.broadcastStatus("checking");

  try {
    const currentVersion = app.getVersion();
    const response = await fetch(
      "https://api.github.com/repos/LeoLun/willow/releases/latest",
      {
        headers: {
          "User-Agent": `willow-desktop/${currentVersion}`,
        },
      }
    );

    let release: any;
    if (!response.ok) {
      if (!app.isPackaged) {
        console.warn(
          "[UpdateService] GitHub API 发生错误，在开发环境下启用 Mock 更新",
        );
        this.isMock = true;
        // ... (原 Mock 更新逻辑不变)
      } else {
        if (response.status === 403) {
          throw new Error("检查更新请求过快，已被 GitHub 限制，请稍后再试（限流错误）");
        }
        throw new Error(`无法获取更新信息: ${response.statusText}`);
      }
    } else {
      this.isMock = false;
      release = (await response.json()) as any;
    }

    // ... (原比对版本和匹配更新类型的逻辑不变)

    // 构建成功响应后，存入缓存
    const result: CheckUpdateResponse = {
      hasUpdate: this.isNewerVersion(currentVersion, latestTag),
      latestVersion: latestTag,
      currentVersion,
      updateType: this.updateType,
      releaseNotes: this.releaseNotes,
      publishDate: release.published_at,
    };

    this.cachedCheckResult = result;
    this.lastCheckTime = now;
    
    // ...
    return result;
  } catch (error: any) {
    // 错误处理逻辑
  }
}
```

### 2. IPC 传输通道契约调整

- `CheckUpdateController` 的 `T` 从 `void` 改为 `{ force?: boolean } | undefined`。
- Preload API 和前端通信层需要透传该参数。

```mermaid
sequenceDiagram
    participant Renderer as 关于页面 (Renderer)
    participant Preload as Preload (ContextBridge)
    participant Main as CheckUpdateController (Main)
    participant Service as UpdateService (Main)
    participant GitHub as GitHub API (Remote)

    Renderer->>Preload: electronAPI.checkUpdate({ force: false/true })
    Preload->>Main: IPC CHECK_UPDATE, { force: false/true }
    Main->>Service: checkUpdate(force)
    alt force is false and cache is fresh
        Service-->>Main: 返回内存缓存数据
        Main-->>Preload: 返回响应数据
        Preload-->>Renderer: 返回数据 (0次网络请求)
    else force is true or cache is expired
        Service->>GitHub: GET /releases/latest (带 User-Agent)
        alt 403 限流
            GitHub-->>Service: 403 Rate Limit Exceeded
            Service-->>Main: 抛出限流 Error (自定义中文)
            Main-->>Preload: 返回错误响应数据
            Preload-->>Renderer: 报错展示
        alt 200 成功
            GitHub-->>Service: 200 OK (Release 数据)
            Service->>Service: 写入缓存及更新时间戳
            Service-->>Main: 返回 CheckUpdateResponse
            Main-->>Preload: 返回响应数据
            Preload-->>Renderer: 更新 UI
        end
    end
```
