# 设计文档：升级 Electron 版本至 39.1.0

## 架构决策与变更点

### 1. 依赖管理升级

Electron 依赖在项目根目录下的 `pnpm-workspace.yaml` 中以 `catalog` 形式管理：

```yaml
catalog:
  electron: 39.1.0
```

升级后，项目内的所有使用 `"electron": "catalog:"` 的模块都将引用 v39.1.0 版本：
- `app/work` (Electron 应用主程序)
- `packages/poetry` (DI与底层框架封装)
- `packages/core` (共享核心包)

### 2. 原生模块重新编译适配 (better-sqlite3)

- Electron v39.1.0 使用 Node.js v22.21.1 运行时。
- 在 `app/work` 目录下运行 `pnpm run rebuild:native`，`electron-rebuild` 将自动针对 Electron 39.1.0 的 ABI 重新编译 `better-sqlite3`。
- 因为 Node 22 API 中没有对 `v8::External::Value()` 造成编译中断的破坏性修改，所以 `better-sqlite3` 可以无需源码修改直接成功编译。
- 同时，无需在项目根目录 `package.json` 中配置任何 `node-abi` 依赖重载。

### 3. API 兼容性检查

- 升级到 39.1.0 相比于之前的 33.2.1 引入了多项性能和安全方面的底层优化。
- 我们需要确保主进程在启动、IPC 通信、窗口控制和 `WebContentsView` 加载方面的表现与之前一致，未引入异常。

## 数据流与运行机制

1. **主进程初始化**：`app/work/src/main/main.ts` 创建应用实例。
2. **IPC 通道注册与绑定**：通过 `@willow/poetry` 装饰器绑定的主进程控制器方法能正常被渲染进程调用。
3. **数据库连接**：`better-sqlite3` 原生驱动能正常在 Electron 39 进程中加载，且 Drizzle ORM 的查询正常运行。
