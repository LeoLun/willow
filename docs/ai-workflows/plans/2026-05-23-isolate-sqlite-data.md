# 执行计划：将 dev 模式和正式安装包的 sqlite 数据隔离

该计划旨在执行 OpenSpec 变更，隔离 Willow 的开发与生产环境数据。

## 执行步骤

### 第一阶段：修改主进程入口代码

- **修改目标**：`app/work/src/main/main.ts`
- **详细修改逻辑**：
  - 判断 `app.isPackaged` 是否为 `false`（开发模式）。
  - 如果为开发模式，则将 `userData` 路径设置为 `join(app.getPath("appData"), "com.willow.work-dev")`。
  - 否则（打包/正式环境），保持 `join(app.getPath("appData"), "com.willow.work")`。
  - 调用 `app.setPath("userData", legacyUserDataPath)`。

### 第二阶段：开发环境本地验证

- **步骤 1**：在根目录下运行 `pnpm dev` 启动应用。
- **步骤 2**：确认应用能够正常打开，并且主进程控制台无异常报错。
- **步骤 3**：在 macOS 的数据目录下检查：
  - 验证是否存在 `~/Library/Application Support/com.willow.work-dev`。
  - 确认该目录下生成了 `willow.db` 数据库、`floating-ball.json` 配置等文件。
- **步骤 4**：在新环境中做一些修改操作（如新建会话、切换设置），确认读写功能一切正常。

### 第三阶段：代码规范与打包验证

- **步骤 1**：运行 `pnpm lint` 检查样式和 Lint 问题。
- **步骤 2**：运行 `pnpm build` 编译所有包，确保没有类型或打包编译报错。

## 终止条件与风险防范

* 如果设置 `app.setPath("userData")` 的时机过晚，导致在此之前某些模块已经初始化并读取了旧的默认路径，需检查其生命周期。目前 `main.ts` 顶层就在执行 `app.setPath`，在 IoC 容器和服务实例化之前，因此风险极低。
* Drizzle 迁移在全新的 `com.willow.work-dev` 下必须能成功运行。若有报错，需确认 migrations 文件夹路径加载是否正确。
