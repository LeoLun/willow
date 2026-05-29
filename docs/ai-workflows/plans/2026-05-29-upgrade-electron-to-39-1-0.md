# 执行计划：升级 Electron 版本至 39.1.0

## 概述

本执行计划包含 3 个执行切片。由于此任务属于全工作空间的框架依赖升级，各步骤具有强前后依赖关系，需按顺序串行执行：
`Slice 1 (升级与安装) ➔ Slice 2 (编译与校验) ➔ Slice 3 (功能与打包验证)`。

---

## Slice 1: 更新配置文件与安装依赖

### 1.1 修改 pnpm-workspace.yaml 中的 electron catalog
**文件**: `pnpm-workspace.yaml` (第 7 行)
将 `electron` 从 `42.3.0` 更新为 `39.1.0`。

```diff
-  electron: 42.3.0
+  electron: 39.1.0
```

### 1.2 移除 package.json 中的 node-abi 覆盖配置
**文件**: `package.json` (第 33-37 行)
移除在尝试升级 Electron 42 时临时添加的 `pnpm.overrides` 以保持项目依赖的简洁。

```diff
-  "pnpm": {
-    "overrides": {
-      "node-abi": "^4.31.0"
-    }
-  }
```

### 1.3 执行依赖安装
在项目根目录下执行以下命令：
```bash
pnpm install
```
**注意**：
- 观察 pnpm 安装日志，确保没有出现严重的 peer dependency 冲突。
- 确认 `pnpm-lock.yaml` 已成功更新。

**验收**: `pnpm install` 成功，无中断报错。

---

## Slice 2: 原生模块编译与全局校验

### 2.1 重新编译原生模块 (better-sqlite3)
针对 Electron 39.1.0 的 ABI 重新编译 `better-sqlite3` 原生模块。
在项目根目录下直接运行：
```bash
pnpm --filter ./app/work run rebuild:native
```
**注意**：
- 确保 `electron-rebuild` 工具能够正常下载 Electron 39.1.0 的 headers。
- 验证 C++ 源码编译不会报错，因为 Node 22 API 中没有对 `v8::External::Value()` 造成编译中断的破坏性修改。

### 2.2 全局静态构建
执行全工作空间打包编译，验证主进程和渲染进程的 TypeScript 及 Bundler 能否正常工作。
在根目录下运行：
```bash
pnpm build
```

### 2.3 代码规范与类型检查
在根目录下运行：
```bash
pnpm lint
```

**验收**: `rebuild:native` 编译成功，`pnpm build` 及 `pnpm lint` 均无 errors/warnings。

---

## Slice 3: 运行与功能/打包验证

### 3.1 本地开发环境启动
在根目录下运行：
```bash
pnpm dev
```
**验证项**：
- [ ] 桌面应用能够被成功拉起，无 crash 现象。
- [ ] 应用主窗口正常显示，渲染主界面（Vue SFC）载入成功。
- [ ] 悬浮球窗口正常悬浮，支持基础拖拽。

### 3.2 数据库与核心逻辑读写验证
- [ ] 在应用中尝试新建会话、发送消息，确认数据库持久化读写功能正常（证明 `better-sqlite3` 原生库加载及驱动调用正常）。
- [ ] 确认主进程和渲染进程的控制台输出，没有因升级 Electron 而导致的破坏性 API 报错或未捕获的 Promise Rejection。

### 3.3 打包分发校验
进入 `app/work` 目录执行打包：
```bash
cd app/work
pnpm package
```
**验证项**：
- [ ] Electron Forge 打包流程能够正常结束，输出 `out/` 文件夹。
- [ ] 打包出来的应用（在 darwin 平台下通常为 `.app`）能够被正常打开。

**验收**: 应用运行无 crash，原生库加载正常，包发布构建顺利完成。

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `pnpm-workspace.yaml` | 更新 `catalog.electron` 的版本至 `39.1.0` |
| 修改 | `package.json` | 移除 `pnpm.overrides` 中的 `node-abi` 重载 |
| 修改 | `pnpm-lock.yaml` | 自动更新依赖锁版本信息 |
