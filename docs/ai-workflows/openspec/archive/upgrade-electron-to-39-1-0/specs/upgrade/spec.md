# Electron 升级规范

## 需求

### R1: 依赖版本统一

- 项目根目录 `pnpm-workspace.yaml` 中定义的 `electron` 版本 MUST 为 `39.1.0`。
- 所有引用 Electron 依赖的子 package（包括 `app/work`、`packages/poetry`、`packages/core`）的 `package.json` 中的 `electron` 依赖版本 MUST 指向 `catalog:`。
- 项目根目录下 `package.json` 不含临时的 `node-abi` 重载配置。

### R2: 原生模块兼容

- `better-sqlite3` 原生库 MUST 能够在升级后的 Electron v39 运行时环境中顺利加载与编译。
- 数据库连接（sqlite）与 CRUD 操作在 Electron v39 下 MUST 正常工作，不能出现原生动态链接库或 node-gyp 兼容性的运行错误。

### R3: 核心窗口生命周期与视图加载

- 主进程初始化及窗口创建方法（主窗口与悬浮球窗口）MUST 能正常运行，并且在 Electron 39.1.0 下以正确的位置和尺寸加载。
- 桌面应用的 Web 视图组件（`WebContentsView`）的嵌入、定位与显示/隐藏控制逻辑 MUST 在新版本下运行正常。

### R4: 打包流程无阻碍

- `app/work` 的打包（`pnpm package`）和分发构建流程 MUST 成功执行，Electron Forge 构建出的应用可以正常运行。

## 验收标准

- [ ] `pnpm-workspace.yaml` 中的 `electron` 依赖版本更新为 `39.1.0`。
- [ ] 执行 `pnpm install` 及原生模块编译 `pnpm run rebuild:native` 成功完成，未发生编译异常。
- [ ] 运行 `pnpm build` 全局构建成功通过，TypeScript 无类型报错，oxlint 无语法错误。
- [ ] 运行 `pnpm dev` 成功拉起 Electron 39.1.0 应用。
- [ ] 应用中主窗口及悬浮球窗口显示完整，功能交互正常。
- [ ] 会话列表、聊天输入以及本地设置持久化等数据库操作可正常读写，无原生模块崩溃或缺失。
- [ ] 在 `app/work` 目录下运行 `pnpm package` 成功打包应用，无异常报错。
