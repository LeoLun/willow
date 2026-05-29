# 升级 Electron 版本到 39.1.0

## 动机

原计划升级至 Electron 42.3.0，但在编译原生模块 `better-sqlite3` 时，由于 Electron v42 使用的 V8 14.8/Node.js 24 引入了指针标记安全机制（对 `v8::External::Value()` API 的签名进行了破坏性更改），导致 `better-sqlite3` 无法在 Electron v42 下完成 C++ 源码的编译。

为了在保证稳定性的同时，尽可能使用更新的 Electron 稳定版本，我们决定调整升级目标，将 Electron 版本升级到 **39.1.0**。Electron 39.1.0 基于 Node.js 22.21.1 和 V8 14.2，它包含了稳定的 ASAR 完整性校验、HDR 渲染支持等，且对我们当前的 `better-sqlite3` 原生模块具有良好的编译兼容性。

## 目标

1. 将 `pnpm-workspace.yaml` 中的 `electron` catalog 版本升级到 `39.1.0`。
2. 确保升级后能够成功执行依赖安装（`pnpm install`）。
3. 确保原生模块（`better-sqlite3`）在 Electron 39.1.0 环境下成功编译。
4. 保证 Electron 应用程序能够正常启动（`pnpm dev`）以及正常打包（`pnpm package`）。

## 范围

- **配置文件变更**：
  - 更新项目根目录下的 `pnpm-workspace.yaml` 中 catalog 部分的 `electron` 字段为 `39.1.0`。
  - 清理根目录 `package.json` 中的 `pnpm.overrides.node-abi` 临时重载配置（因为 Electron 39 完全被现有依赖库支持，无需重载）。
- **依赖管理**：
  - 执行 `pnpm install` 更新 `pnpm-lock.yaml`。
  - 重新编译原生模块 `better-sqlite3`。
- **流程校验**：
  - 验证开发环境启动和构建包打包流程。

## 非范围

- 升级其他与本次 Electron 升级无关的依赖包。
- 更改任何业务逻辑、UI 设计。
