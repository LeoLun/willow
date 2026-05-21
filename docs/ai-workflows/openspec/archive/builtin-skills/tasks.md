# 任务列表

## 1. 创建内置技能目录与测试技能
- [ ] 创建目录 `app/work/builtin-skills/`
- [ ] 创建一个测试用的内置技能，例如 `app/work/builtin-skills/echo-test/SKILL.md`，并在其中编写 frontmatter name 和 description。

## 2. 修改共享核心包 `@willow/core` 的技能加载逻辑
- [ ] 修改 `packages/core/src/skills.ts` 中的 `loadSkills`：
  - 支持 options 传入 `builtinDir`。
  - 在返回值 `LoadSkillsResult` 中回传 `builtinDir`。
  - 从 `builtinDir` 中递归查找所有的 `SKILL.md` 技能文件并进行解析。
- [ ] 修改 `mergeByName` 函数，接收并合并 `builtinSkills`。确保其优先级最低，在冲突时被 `userSkills` 和 `projectSkills` 覆盖。

## 3. 修改 Electron 主进程与 Agent 实例化逻辑
- [ ] 修改 `app/work/src/main/service/skill.service.ts`：
  - 在 `getAvailableSkills()` 中，动态计算 `builtinDir` 路径（打包后取 `process.resourcesPath/builtin-skills`，开发环境下取 `app.getAppPath()/builtin-skills`）。
  - 将 `builtinDir` 传给 `loadSkills()`。
  - 修改 `resolveScope()` 和返回的 `scopeLabel` 逻辑，在检测到文件属于 `builtinDir` 时，其 `scopeLabel` 设为 `"内置"`。
- [ ] 修改 `packages/core/src/core-agent.ts` 中的 `CoreAgentOptions`，新增 `builtinDir?: string` 参数，并在 `CoreAgent` 构造函数中将该参数传给 `loadSkills()`。
- [ ] 修改 `app/work/src/main/service/agent.service.ts`：
  - 在实例化 `CoreAgent` 时，动态计算 `builtinDir` 并传入 options 中。

## 4. 修改打包配置以携带内置技能
- [ ] 修改 `app/work/forge.config.mjs` 中的 `packagerConfig.extraResource`：
  - 增加对 `./builtin-skills` 文件夹的拷贝，使其能够跟随应用一同打包发布。

## 5. 验证与清理
- [ ] 运行代码检查与类型构建验证：
  - `pnpm lint` 检查代码样式。
  - `pnpm build` 重新构建所有包（包括 packages/core 和 app/work）。
- [ ] 手动测试验证：
  - 启动 UI/Electron 客户端，在对话框中输入 `/`，确认出现刚才添加的测试技能，且其右侧标签显示为“内置”。
  - 将同名技能复制到项目下的 `.agents/skills/` 目录，确认重新载入后标签变为“工作空间”。
  - 检查应用打包或构建过程中无异常。
