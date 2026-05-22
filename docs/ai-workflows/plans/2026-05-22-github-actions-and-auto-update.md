# Execution Plan: GitHub Actions 构建与应用内自动更新机制 (双轨更新支持)

本执行计划针对 `github-actions-and-auto-update` 变更，旨在实现 GitHub Actions 自动化双芯片 Mac 构建，并在 Willow 桌面应用端内增加自动更新检测与下载挂载安装包逻辑，完整支持整包大版本更新 (DMG 挂载拖拽) 与小版本增量更新 (ASAR 替换重启)。

## 1. 计划详情

我们将实施划分成 5 个执行分片：

### Slice 1: GitHub Actions 持续集成工作流
- **文件**：`.github/workflows/release.yml` [NEW]
- **实现内容**：
  - 配置基于 `macos-latest` 的 CI 工作流。
  - 使用 `pnpm` (9.15.4) 及相关缓存。
  - 构建整体 monorepo 项目：`pnpm build`。
  - 构建双端架构安装包：
    - `pnpm --filter willow-work run make:mac --arch=arm64` (Apple Silicon)
    - `pnpm --filter willow-work run make:mac --arch=x64` (Intel)
  - 提取并重命名 `app.asar` 资产：
    - Electron Forge 构建完成后，将 `app/work/out/willow-darwin-arm64/willow.app/Contents/Resources/app.asar` 提取出来，方便作为增量包进行发布。由于 `app.asar` 不含 native 部分且跨架构通用，我们提取一份即可。
  - 采用 `softprops/action-gh-release@v2`，将输出的 `.dmg`、`.zip` 附件以及提取出来的 `app.asar` 作为资产一并上传发布至对应的 Release。
- **校验**：审查 yaml 文件结构是否满足 release 资产上传需求。

### Slice 2: IPC 通信定义与共享层桥接
- **文件**：
  - `app/work/src/shared/constants.ts` [MODIFY]
  - `app/work/src/shared/api.ts` [MODIFY]
  - `app/work/src/shared/hook/update.hook.ts` [NEW]
  - `app/work/src/shared/hook/index.ts` [MODIFY]
  - `app/work/src/preload/preload.ts` [MODIFY]
- **实现内容**：
  - 在 `api.ts` 的 `CheckUpdateResponse` 中新增 `updateType: "full" | "incremental"` 字段。
  - 在 `CheckUpdateResponse` 中返回 `latestVersion`、`releaseNotes`、`publishDate`。
  - 确保 IPC 数据通路（`CHECK_UPDATE`, `START_DOWNLOAD`, `INSTALL_UPDATE` 等）及其对应的方法签名完全桥接通过。
- **校验**：确保 `pnpm build` 在共享包层成功，没有类型丢失或冲突。

### Slice 3: 主进程更新服务与控制器实现
- **文件**：
  - `app/work/src/main/service/update.service.ts` [NEW]
  - `app/work/src/main/controllers/config/check.update.controller.ts` [NEW]
  - `app/work/src/main/controllers/config/start.download.controller.ts` [NEW]
  - `app/work/src/main/controllers/config/install.update.controller.ts` [NEW]
  - `app/work/src/main/app.module.ts` [MODIFY]
- **实现内容**：
  - 编写 `UpdateService` 的核心双轨更新判定与执行逻辑：
    - **版本分类检测 (`checkUpdate`)**：
      - 获取本地版本 `app.getVersion()` 与最新 Tag `latestTag` 并按 SemVer 规范对比。
      - 解析大版本号：若 `latestMajor > currentMajor`，判定为 `"full"` 类型更新（整包更新）。
      - 若主版本相同且有新版，扫描 Release Assets：
        - 若包含 `app.asar` 文件，判定为 `"incremental"`（增量更新）。
        - 若不包含，回退判定为 `"full"`（整包更新）。
      - 根据 `updateType` 匹配资源链接：
        - 若为 `full`，匹配当前架构 `process.arch` 的 `.dmg` 资产；
        - 若为 `incremental`，直接下载 `app.asar` 资产。
    - **下载进度流式回显 (`startDownload`)**：
      - 使用原生 fetch 请求下载链接，获取 Response 对象的 `ReadableStream` 字节流。
      - 配合内容长度 `content-length` 在读取流的过程中，实时计算进度百分比，通过 `EventService` 向渲染进程广播 `UPDATE_STATUS_CHANGED`。
      - 增量更新保存为临时 ASAR 文件（例如 `app.asar.tmp`）；整包更新保存为临时 `.dmg` 文件。
    - **安装与替换重启 (`installUpdate`)**：
      - **整包更新 (Full)**：使用 `shell.openPath` 挂载临时 DMG 文件，提示用户手动拖拽安装。
      - **增量更新 (Incremental)**：
        - 若在非打包开发环境 (`!app.isPackaged`)，跳过物理文件覆盖替换，仅模拟 `app.relaunch()` 以防破坏开发目录。
        - 若在生产打包环境：
          1. 确定运行中的 `app.asar` 位置（在 `process.resourcesPath/app.asar`）。
          2. 将其重命名备份为 `app.asar.old`。
          3. 将下载的临时 `app.asar.tmp` 写入/重命名为 `app.asar` 路径。
          4. 执行 `app.relaunch()` 重启，并调用 `app.exit(0)` 退出当前实例。
    - **启动清理**：
      - 构造函数中添加异步删除 `process.resourcesPath/app.asar.old` 遗留文件的逻辑。
  - 在三个 Controller 中绑定对应的 IPC Channel 并调用 `UpdateService`。
  - 在 `app.module.ts` 中注册 `UpdateService` 和这三个控制器。
- **校验**：确保应用编译成功且控制器在主进程初始化中正常工作。

### Slice 4: 前端设置页面 UI 与状态管理
- **文件**：
  - `app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue` [MODIFY]
- **实现内容**：
  - 在页面上新增“自动更新”卡片组件，包含：当前版本、检查更新按钮、更新日志。
  - 接入 IPC 通道：使用 `window.electronAPI.checkUpdate()`。
  - 监听状态广播事件 `UPDATE_STATUS_CHANGED`，动态驱动组件的更新状态机 (checking / available / downloading / downloaded / error / idle)。
  - 更新类型 UI 适配：
    - 当为整包更新时，显示标签“大版本更新 (DMG 拖拽覆盖)”，按钮文案为“下载更新安装包”；下载完成后按钮变为“打开 DMG 安装包”。
    - 当为增量更新时，显示标签“增量热更新 (重启即用)”，按钮文案为“立即更新”；下载完成后按钮变为“重启并更新”。
- **校验**：
  - 本地降低 `package.json` 中的 `version` 模拟低版本升级，开启 `pnpm dev` 校验完整交互环。

### Slice 5: 全局构建与手动验证
- **实现内容**：
  - 本地低版本检测及升级模拟测试（增量和整包双路径）。
  - 运行 `pnpm lint` 格式与风格验证。
  - 运行 `pnpm build` 构建成功验证。

---

## 2. 验证与停止条件

### 自动验证
1. 运行 `pnpm lint` 确保没有 Oxlint 静态规则检查报错。
2. 运行 `pnpm build` 确认所有模块类型、依赖包可以被全部正常构建出来且没有类型错误。

### 手动验收条件
- 伪造本地 app 版本比最新版本低。
- 渲染页面能提示最新版本、GitHub Release 原本的更新日志文案，且显示正确的更新类型标签（“增量更新”或“大更新”）。
- 下载任务可执行，进度百分比能够动态正常增长。
- 整包更新下载完成后，点击按钮能够挂载并打开 DMG 文件。
- 增量更新下载完成后，点击按钮能够执行模拟重启（开发环境下不覆盖文件但执行 Relaunch），或者在打包包里执行覆盖替换重启并清理 old 文件。
