# 架构与设计决策：GitHub Actions 与自动更新

## 1. GitHub Actions 工作流设计

在项目根目录下新建 `.github/workflows/release.yml`，定义持续集成和发布流程：

### 流程阶段
1. **触发条件**：
   - 监听 Git Tags: `v*` (如 `v1.0.0`)。
   - 支持通过 `workflow_dispatch` 手动触发。
2. **运行环境**：
   - 使用 macOS 构建机（如 `macos-latest` 或 `macos-14`），因为同时构建 Apple Silicon (arm64) 和 Intel (x64) 二进制包，macOS 是最简便的选择。
3. **步骤分解**：
   - **Checkout Code**：拉取最新代码。
   - **Install PNPM**：使用 `pnpm/action-setup@v3` 安装 pnpm 9.15.4。
   - **Setup Node.js**：设置 Node.js 20.x。
   - **Pnpm Cache & Install**：拉取并安装 npm 依赖。
   - **Build Workspace**：
     - 在根目录下运行 `pnpm build`。这会递归构建 monorepo 中所有子包。
   - **Mac Make (arm64 & x64)**：
     - 进入 `app/work` 目录，执行打包和制作分发包操作：
       - `pnpm run make:mac --arch=arm64`（输出 Apple Silicon 版 DMG & ZIP）
       - `pnpm run make:mac --arch=x64`（输出 Intel 版 DMG & ZIP）
     - *注意*：由于 native 模块（如 `better-sqlite3`）在 Electron 中需要重新编译，在 GitHub Actions 的 macOS 环境中，`electron-rebuild` 会编译出匹配当前机器及 target 架构的 native 二进制。我们需要确保 `rebuild:native` 步骤正确处理。
   - **Release Draft / Publishing**：
     - 使用 `softprops/action-gh-release@v2`，将 `app/work/out/make/dmg/darwin/arm64/*.dmg`、`app/work/out/make/dmg/darwin/x64/*.dmg`、`app/work/out/make/zip/darwin/arm64/*.zip`、`app/work/out/make/zip/darwin/x64/*.zip` 等作为资产上传到对应的 GitHub Release 中。
     - 若触发源是 Tag，则直接发布为正式 Release；若是手动触发，则发布为 Draft。

---

## 2. 自动更新逻辑架构（主进程）

为了提供更好的更新体验，我们设计了双轨更新机制：
1. **整包大版本更新**：针对 Major 跨度大版本，或没有发布增量 `app.asar` 时，采用流式下载对应 CPU 架构 `.dmg` 包，并使用 `shell.openPath` 唤起 DMG 由用户拖拽覆盖安装。
2. **增量热更新**：针对 Minor/Patch 小版本且 Release assets 中包含 `app.asar` 时，流式下载该 ASAR 文件，自动完成重命名备份、覆盖替换并重启应用。

### 1) 新增主进程更新服务：`UpdateService`

在 `app/work/src/main/service/update.service.ts` 中实现：
- 使用 `@Injectable()` 进行注册。
- **获取最新版本并判断更新类型**：
  - 调用 `https://api.github.com/repos/LeoLun/willow/releases/latest`。
  - 请求中需包含 `User-Agent: willow-updater` 标头以规避限制。
  - 获取 `latestVersion`（如 `v1.0.1`）后，通过语义化版本比较算法与本地 `app.getVersion()` 进行比对。
  - **更新分类决策树**：
    - 若 `latestMajor > currentMajor`：判定为 `updateType = 'full'`（整包更新）。
    - 若 `latestMajor === currentMajor`：判定为可能有增量更新。系统扫描 releases assets：
      - 若 assets 中存在 `app.asar` 文件：判定为 `updateType = 'incremental'`（增量更新）。
      - 若 assets 中不存在 `app.asar` 文件：退回判定为 `updateType = 'full'`（整包更新）。
- **下载与进度通知**：
  - **整包更新**：根据当前平台与芯片架构匹配 `process.arch` ('arm64' | 'x64')，下载对应的 `.dmg` 资产到系统临时目录。
  - **增量更新**：下载 `app.asar` 资产到系统临时目录。
  - 下载过程中，使用原生 fetch 配合 `ReadableStream` 循环读取流，实时计算百分比并通过 `EventService` 向渲染进程广播 `UPDATE_STATUS_CHANGED` 事件。
- **执行安装**：
  - **整包安装 (`shell.openPath`)**：
    - 直接通过 `shell.openPath(tempFilePath)` 调起 DMG 镜像挂载，用户看到 Finder 窗口并手动拖拽到 Applications 中。
  - **增量热安装 (ASAR 替换)**：
    - 目标 ASAR 路径：`const appAsarPath = join(process.resourcesPath, 'app.asar')`。
    - 若在开发环境 (`!app.isPackaged`)，跳过替换，只执行 Relaunch 以进行模拟调试。
    - 若在生产环境：
      1. 将当前 `appAsarPath` 重命名备份为 `appAsarPath + '.old'`。
      2. 将已下载的临时 ASAR 文件移动或重命名写入到 `appAsarPath`。
      3. 调用 `app.relaunch()` 并执行 `app.exit(0)` 立即重启应用。
- **启动旧文件清理**：
  - 在 `UpdateService` 的构造器中，执行一次异步检测：若 `appAsarPath + '.old'` 文件存在，则调用 `fs.promises.unlink` 将其删除，确保不会残留无效冗余。

### 2) 新增主进程 IPC 控制器：`UpdateController`

在 `app/work/src/main/controllers/config/` 下分别创建三个控制器类：
- `CheckUpdateController` (绑定 `CHECK_UPDATE` 通道)
- `StartDownloadController` (绑定 `START_DOWNLOAD` 通道)
- `InstallUpdateController` (绑定 `INSTALL_UPDATE` 通道)
- 在 `app.module.ts` 中注册 `UpdateService` 和这三个控制器。

---

## 3. 渲染进程 UI 交互设计

更新功能将挂载在设置页面（`ConfigurationSetting.vue`）中，采用状态机驱动：

### UI 状态流转机
1. **空闲状态 (idle)**：展示“检查更新”按钮。
2. **检查中 (checking)**：按钮置灰，展示 “正在检查最新版本...”。
3. **已经是最新**：提示“当前已是最新版本”。
4. **发现新版本 (available)**：
   - 展示新版本号：`最新版本: v1.0.1`。
   - 展示更新类型标签：`大版本更新 (DMG 拖拽覆盖)` 或 `增量热更新 (重启即用)`。
   - 展示更新日志（从 Release 的 `body` 字段获取，使用简易渲染）。
   - 展示操作按钮：
     - 整包更新：展示“下载更新安装包”。
     - 增量更新：展示“立即更新”。
5. **下载中 (downloading)**：展示进度条，显示进度百分比（如 `正在下载: 45%`）。
6. **下载完成 (downloaded)**：
   - 整包更新：按钮变为“打开 DMG 并安装”，点击后调起挂载。
   - 增量更新：按钮变为“重启并更新”，点击后自动完成文件替换并重启。
7. **错误状态 (error)**：显示错误信息，并保留重试按钮。

---

## 4. 数据结构与接口协议

在 `app/work/src/shared/` 中扩展：

### 1) IPC 常量 (`shared/constants.ts`)
```typescript
export const CHECK_UPDATE = "CHECK_UPDATE";
export const START_DOWNLOAD = "START_DOWNLOAD";
export const INSTALL_UPDATE = "INSTALL_UPDATE";
export const UPDATE_STATUS_CHANGED = "UPDATE_STATUS_CHANGED";
```

### 2) 数据结构 (`shared/api.ts`)
```typescript
export interface CheckUpdateRequest {}

export interface CheckUpdateResponse {
  hasUpdate: boolean;
  latestVersion: string;
  updateType?: "full" | "incremental";
  releaseNotes?: string;
  publishDate?: string;
}

export interface StartDownloadRequest {}
export interface StartDownloadResponse {
  success: boolean;
}

export interface InstallUpdateRequest {}
export interface InstallUpdateResponse {
  success: boolean;
}

export interface UpdateStatusPayload {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  progress?: number; // 0 - 100
  errorMsg?: string;
}
```
