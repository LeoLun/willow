# 2026-05-21-refactor-builtin-skills 执行计划

本计划将引导完成内置技能 `init` 执行逻辑向普通技能的对齐与重构，移除主进程的拦截逻辑与专门的代写服务 `WorkspaceInitService`。

## 变更文件列表

### [Component: Electron Main Process]
- [MODIFY] [session.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts)
- [MODIFY] [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts)
- [DELETE] [workspace-init.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/workspace-init.service.ts)

---

## 任务拆解与执行步骤

### 步骤 1: 清理 WorkspaceInitService 服务与模块声明
1. **删除服务文件**：删除主进程下的 `workspace-init.service.ts` 文件。
2. **移除模块引用**：
   - 修改 [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts)，移除对 `WorkspaceInitService` 的 `import` 和 `providers` 中的注册。

### 步骤 2: 移去 SessionService 内置拦截逻辑
1. **移除依赖注入**：
   - 修改 [session.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts)，移除对 `WorkspaceInitService` 的导入、构造函数中的注入项 `workspaceInitService`。
2. **清除拦截代码**：
   - 在 `sendMessage` 方法中，清除 `isInitCommand` 相关的判断，不再有拦截逻辑。
   - 彻底删除 `executeWorkspaceInitCommand` 私有方法。

### 步骤 3: 编译与代码检查验证
1. 在项目根目录下执行 `pnpm lint` 检查是否有 lint 错误或未引用的导出残留。
2. 执行 `pnpm build` 确认整个 monorepo 和 packages 编译成功。

### 步骤 4: 运行时端到端验证
1. 启动 Electron 开发服务器：在根目录运行 `pnpm dev`。
2. 打开一个项目工作空间的会话。
3. 在输入框输入 `/`，在下拉列表中选择 `init` 技能，并发送。
4. 确认 AI 启动，并执行工具调用来读取工作空间、生成 `AGENTS.md`、在终端中调用 `node builtin-skills/init/scripts/ensure-frontmatter.js ...`，最终输出生成成功后的正常回复。
5. 确认工作空间根目录下生成的 `AGENTS.md` 包含正确的 frontmatter（带有 `name` 和 `description`）并且格式符合规范。

---

## 异常与终止条件

- **若 AI Agent 执行 `init` 技能时遭遇权限问题或找不到工具**：确认 AI Agent 拥有 `command` 权限，确保其可运行 `ensure-frontmatter.js` 脚本。
- **编译时报错**：如果删除 `WorkspaceInitService` 导致其它依赖项缺失，需退回 `app.module.ts` 检查是否有其它未被发现的直接依赖，并将其一并清理。

## 下一步

计划完成后，我们将进入 `workflow-implement` 阶段执行上述步骤。
