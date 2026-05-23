# 设计文档：将 dev 模式和正式安装包的 sqlite 数据隔离

## 架构决策

为了确保隔离方案的彻底与高内聚，我们采取了**在应用初始化入口处重定向 `userData` 路径**的决策。

### 1. 全局 `userData` 路径重定向

在 Electron 中，`app.getPath("userData")` 是各类数据存储的默认基准路径。目前在 `app/work/src/main/main.ts` 中是这样初始化的：

```typescript
const legacyUserDataPath = join(app.getPath("appData"), "com.willow.work");
app.setPath("userData", legacyUserDataPath);
```

我们将在此处通过 `app.isPackaged` 判断当前是否为开发模式：
- **开发模式（`!app.isPackaged`）**：使用 `com.willow.work-dev`。
- **打包模式（`app.isPackaged`）**：继续使用原有的 `com.willow.work`。

修改后的逻辑如下：

```typescript
const folderName = app.isPackaged ? "com.willow.work" : "com.willow.work-dev";
const legacyUserDataPath = join(app.getPath("appData"), folderName);
app.setPath("userData", legacyUserDataPath);
```

### 2. 为什么选择重定向 `userData` 而非单独修改 SQLite 路径？

在 Willow 仓库中，除了 SQLite 数据库以外，还有多个服务利用 `app.getPath("userData")` 存储重要数据：
* **`DbService`**：存储 `willow.db` 数据库。
* **`FloatingBallService`**：存储 `floating-ball.json` 悬浮球配置文件。
* **`SkillService`**：存储自定义或下载的 Agent 技能，路径为 `.agents/skills`。
* **`WorkspaceService`**：存储会话运行时生成的文件，路径为 `workspace/*`。

如果仅修改 `DbService` 中 SQLite 的数据库文件名（例如 `willow-dev.db`），其他服务如 `WorkspaceService` 仍会把开发期间产生的文件写入生产环境的 `workspace` 目录下。因为数据库中的 workspace ID 自增主键可能会在开发和正式环境之间冲突，导致文件覆盖或错乱。

通过修改全局 `userData`，所有相关路径都会随之变动：
- 开发模式 SQLite：`~/Library/Application Support/com.willow.work-dev/willow.db`
- 开发模式悬浮球配置：`~/Library/Application Support/com.willow.work-dev/floating-ball.json`
- 开发模式技能路径：`~/Library/Application Support/com.willow.work-dev/.agents/skills`
- 开发模式工作区：`~/Library/Application Support/com.willow.work-dev/workspace/*`

这样可以在零耦合、零修改其他服务代码的前提下，达成完美的沙箱隔离。

### 3. 数据流与初始化生命周期

1. **应用启动**：主进程入口 `main.ts` 执行，修改 `userData` 路径。
2. **IoC 容器启动**：`CoreFactory.create(AppModule)` 运行，解析并注入依赖。
3. **数据库服务初始化**：`DbService.init()` 运行时调用 `app.getPath("userData")`，得到被重定向后的隔离路径，在此目录下创建全新的 SQLite 数据库并运行 Drizzle Schema 迁移。
4. **其他服务初始化**：所有需要读写本地文件系统的服务都在独立的 `-dev` 沙箱中运作。
