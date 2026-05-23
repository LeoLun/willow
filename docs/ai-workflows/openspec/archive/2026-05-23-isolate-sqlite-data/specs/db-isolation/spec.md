# 规范：开发与生产环境数据隔离

## 需求

### R1: 独立的数据沙箱路径

在开发模式下启动应用时，其关联的 `userData` 根路径 MUST 为专属的开发用目录名，即 `com.willow.work-dev`。
在打包发布的生产环境运行应用时，其关联的 `userData` 根路径 MUST 保持为原本的目录名，即 `com.willow.work`。

### R2: SQLite 数据库隔离

由于 `DbService` 从 `userData` 获取数据库位置，此项重定向 MUST 保证：
- 开发模式下的所有增删改查及 Drizzle 迁移均在 `com.willow.work-dev/willow.db` 独立运行。
- 正式安装包运行时仍使用 `com.willow.work/willow.db`，两者数据在物理和逻辑上完全解耦。

### R3: 级联数据隔离

其它所有依赖 `app.getPath("userData")` 的业务功能也 MUST 自动归宿到相应的目录下。包括但不限于：
1. 会话工作区文件（`workspace/*`）
2. 悬浮球配置（`floating-ball.json`）
3. 自定义及下载的技能（`.agents/skills`）
4. Chromium 内置的数据（localStorage, IndexedDB, Cookies, Caches 等）

### R4: 无痛升级与向后兼容

- 已经打包的生产版 Willow 用户在升级后，必须无缝读取他们原本在 `com.willow.work` 里的数据库，数据不可丢失。
- 开发者直接启动 `pnpm dev` 时，系统必须能够自动在新开发目录下运行 Drizzle 的所有初始和增量 migration，不需要手动复制或执行 SQL 脚本。

## 验收标准

- [ ] 1. 运行 `pnpm dev` 后，在系统 `appData` 中能看到新创建的 `com.willow.work-dev` 文件夹。
- [ ] 2. `com.willow.work-dev` 文件夹内生成了 `willow.db`（SQLite 数据库文件），且不存在由于历史开发产生的 schema 冲突导致迁移失败的问题。
- [ ] 3. 在开发环境下建立的 Workspace 目录位于 `com.willow.work-dev/workspace`。
- [ ] 4. 正式打包的版本（`isPackaged === true`）在运行时，不应读写 `com.willow.work-dev` 目录，仍指向 `com.willow.work`。
