# 任务列表

## 1. GitHub Actions 流水线搭建
- [x] 创建 `.github/workflows/release.yml` 文件。
- [x] 配置支持 Tag (v*) 及 workflow_dispatch 触发。
- [x] 配置 pnpm、Node 20 环境，支持依赖缓存。
- [x] 编写全包构建命令 `pnpm build`。
- [x] 编写打包及生成命令 `pnpm --filter willow-work run make:mac --arch=x64` 和 `pnpm --filter willow-work run make:mac --arch=arm64`。
- [x] 配置 `softprops/action-gh-release@v2` 归档上传 DMG/ZIP 以及 `app.asar` 热更新产物。

## 2. 定义 IPC 协议及 API 类型
- [x] 在 `app/work/src/shared/constants.ts` 中新增更新相关的 IPC 通信常量。
- [x] 在 `app/work/src/shared/api.ts` 中新增 `CheckUpdate`、`StartDownload`、`InstallUpdate`、`UpdateStatusPayload` 等数据接口定义。

## 3. 实现主进程逻辑 (UpdateService & UpdateController)
- [x] 在 `app/work/src/main/service/` 下创建 `update.service.ts`：
  - 实现检测最新 Release API 逻辑。
  - 实现本地与线上版本比对逻辑，并支持区分大版本（整包更新）与小版本（增量更新）。
  - 实现根据更新类型下载对应资产（`.dmg` 或 `app.asar`）的流式下载逻辑，并输出下载进度（百分比）。
  - 实现整包更新下通过 `shell.openPath` 挂载 DMG 文件的逻辑。
  - 实现增量更新下替换 `app.asar` 并触发 `app.relaunch()` 重启的逻辑。
  - 实现启动时异步清理 `.old` 备份文件逻辑。
- [x] 在 `app/work/src/main/controllers/` 下新建 update 控制器（`check.update.controller.ts`, `start.download.controller.ts`, `install.update.controller.ts`）处理 IPC 请求。
- [x] 在 `app/work/src/main/app.module.ts` 中注册 `UpdateService` 和相关控制器。
- [x] 更新 `preload.ts` 将相关的 IPC 调用暴露到 `contextBridge`。

## 4. 确认 Preload 绑定与 IPC 桥接
- [x] 检查 `app/work/src/preload/preload.ts`，确保渲染进程可以通过 Electron API 调用主进程中新添加的更新 IPC 服务。

## 5. 实现前端设置界面交互
- [x] 在设置面板 file (ConfigurationSetting.vue) 中新增“自动更新”设置卡片。
- [x] 在页面中展示当前 Willow 的本地版本号（通过渲染进程获取当前版本）。
- [x] 编写组件内的更新状态机（idle / checking / available / downloading / downloaded / error），并增加更新类型的界面展示与按钮文案适配。
- [x] 绑定“检查更新”按钮点击事件，调用主进程 `CHECK_UPDATE`。
- [x] 渲染新版本更新日志 Markdown（可采用简易解析或文本渲染形式）。
- [x] 绑定“立即更新”/“下载更新”开始下载，并展示百分比进度条。
- [x] 绑定下载完成后的安装/重启按钮：
  - 整包更新：点击发送 `INSTALL_UPDATE` 调起 DMG 挂载。
  - 增量更新：点击发送 `INSTALL_UPDATE` 触发 `app.asar` 替换并自动重启。

## 6. 构建与安装验证
- [x] 本地模拟更新流程：修改本地 package.json 版本为更低的版本，连接真实的 GitHub API 触发更新提醒，验证下载进度展现及最终 DMG 挂载成功。
- [x] 运行 `pnpm lint` 验证无代码规范报错。
- [x] 运行 `pnpm build` 确认项目可以正常编译且未引入类型报错。
