# Execution Plan: 将静态资源打包入 app.asar 实现完整增量更新

本执行计划针对静态资源（数据库迁移脚本、内置 Skill、工作空间模板）的更新机制进行重构，通过将这些资源全量放入 `app.asar` 内部，配合 `app.getAppPath()` 统一路径读取，以支持完整、安全的增量热更新（替换 `app.asar` 即完成所有资源的升级，杜绝版本不一致问题）。

## 1. 计划详情

我们将实施划分成 2 个执行分片：

### Slice 1: 移除 forge.config.mjs 的外部资源挂载
- **文件**：`app/work/forge.config.mjs` [MODIFY]
- **实现内容**：
  - 将 `packagerConfig.extraResource` 数组中的 `"./src/main/db/migrations"`、`"./builtin-skills"`、`"./templates"` 移除。
  - 确保这些文件夹在 `package` 时作为普通文件随着主程序目录打包进入 `app.asar`。
- **校验**：确认打包配置正确，无语法错误。

### Slice 2: 重构主进程服务中的路径定位
- **文件**：
  - `app/work/src/main/service/db.service.ts` [MODIFY]
  - `app/work/src/main/service/skill.service.ts` [MODIFY]
  - `app/work/src/main/service/workspace.service.ts` [MODIFY]
  - `app/work/src/main/service/agent.service.ts` [MODIFY]
- **实现内容**：
  - 在以上服务文件中，重构定位 `migrations`、`builtin-skills` 和 `templates` 目录的方法。
  - 放弃对 `app.isPackaged` 的差异化处理，在开发环境与生产环境均统一使用 `app.getAppPath()` 定位包内对应目录：
    - `migrations`: `join(app.getAppPath(), "src/main/db/migrations")`
    - `builtin-skills`: `join(app.getAppPath(), "builtin-skills")`
    - `templates`: `join(app.getAppPath(), "templates")`
- **校验**：运行编译，确保无编译及 oxlint 报错。

---

## 2. 验证与停止条件

### 自动验证
1. 运行 `pnpm lint` 确保没有 Oxlint 静态规则检查报错。
2. 运行 `pnpm build` 确认项目可以正常构建。

### 手动验收条件
1. 在开发模式下运行 `pnpm dev`，确认应用启动、数据库初始化、Skill 读取、工作区模板读取完全正常。
2. 本地执行 `pnpm --filter willow-work package` 并在输出的包结构中确认 `Resources/` 下无 `migrations`、`builtin-skills`、`templates` 文件夹。
3. 运行打包后的二进制文件，验证功能一切正常。
