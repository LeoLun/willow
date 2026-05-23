# 提案：将 dev 模式和正式安装包的 sqlite 数据隔离

## 动机

当前 Willow 的开发模式和正式安装包共享同一个 Electron `userData` 目录（即 `com.willow.work`）。这导致它们的 SQLite 数据库文件（`willow.db`）以及其他用户配置和工作区数据共用同一个目录。

这种共享在日常开发和测试中会带来以下问题：
1. **数据库 Schema 冲突**：当开发分支更新了 Drizzle schema 但尚未在生产包发布时，运行开发模式会应用新的迁移，导致已安装的生产包无法正常读取或写入数据库。
2. **数据污染**：开发和测试过程中产生的垃圾测试数据、临时会话与技能会直接混合在用户的正式使用数据中，导致正式环境数据变得混乱。
3. **隔离安全性**：开发测试时的异常崩溃或数据损坏有可能会破坏生产包中用户的真实工作数据。

因此，实现开发环境和正式生产环境的数据和 SQLite 数据库的完全隔离是非常必要的。

## 目标

1. 隔离开发模式（`!app.isPackaged`）和正式安装包（`app.isPackaged`）的 SQLite 数据库。
2. 隔离开发模式和正式安装包的其他用户数据（包括 `floating-ball.json` 配置文件、`.agents/skills` 技能目录、`workspace/*` 工作区文件等），确保两者的运行环境完全独立。
3. 确保该隔离对开发人员透明，无需额外的手动配置。

## 范围

* **主进程入口配置**：在 `app/work/src/main/main.ts` 中，使用 `app.isPackaged` 区分运行模式。如果是开发模式，将 `userData` 目录重定向至 `com.willow.work-dev`；如果是打包模式，保持原有的 `com.willow.work`。
* **依赖验证**：确认现有的所有服务（`DbService`, `AgentService`, `SkillService`, `WorkspaceService`）都依赖 `app.getPath("userData")` 作为基准路径，从而通过入口处的重定向自动实现多维度数据的全部隔离。

## 非范围

* **不改变打包的 Bundle ID**：不修改打包配置中的 `appBundleId`，仅在运行时根据是否打包动态重定向 `userData` 路径。
* **数据自动迁移**：不需要把原 `com.willow.work` 中的测试数据自动拷贝到 `com.willow.work-dev` 中。开发环境启动时直接从零初始化。
