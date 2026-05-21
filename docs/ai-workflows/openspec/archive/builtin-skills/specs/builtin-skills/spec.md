# 内置技能目录规范

## 需求

### R1: 指定内置技能目录

系统 MUST 能够从代码库指定的内置技能目录加载技能。
- 目录路径在开发环境下为：`app/work/builtin-skills`。
- 目录路径在打包环境下为：`process.resourcesPath/builtin-skills`。
- 在该目录下每个技能同样遵循 `SKILL.md` 的规范（包含 frontmatter name 和 description）。

### R2: 技能优先级合并机制

内置技能 MUST 作为备用技能加载，且其优先级最低。
- 当内置技能与全局用户技能（`userSkills`）或项目技能（`projectSkills`）发生名称（`name`）冲突时，内置技能 MUST 被覆盖/忽略。
- 最终技能合并逻辑优先级由高到低依次为：
  1. 全局用户技能（`userSkills`）
  2. 工作空间项目技能（`projectSkills`）
  3. 内置技能（`builtinSkills`）
- 技能合并时如果内置技能被高优先级技能覆盖，应在 `warnings` 中记录（或保持现有冲突警告机制）。

### R3: 内置技能 UI 展示

内置技能的范围（scope）和标签（scopeLabel）在 UI 交互中 MUST 标识为“内置”。
- `SkillService.getAvailableSkills` 返回的技能信息中，内置技能的 `scope` 可设为 `global`，但其 `scopeLabel` MUST 为 `"内置"`。
- 在聊天界面的 slash `/` 资源选择器中，内置技能应该能够被正确检索、显示，并展示“内置”标签。

### R4: 应用构建打包支持

应用在执行打包时，内置技能目录 MUST 被完整拷贝到最终发布的 Resources 目录中。
- `app/work/forge.config.mjs` 中的 `packagerConfig.extraResource` MUST 包含 `./builtin-skills`。

## 验收标准

- [ ] 在 `app/work/builtin-skills/` 下放入测试技能，启动应用后，聊天框输入 `/` 可在列表中看到该技能。
- [ ] 对应的技能在选择列表中，右侧的标签显示为“内置”。
- [ ] 若在项目 `.agents/skills/` 下创建了一个同名的技能，则该内置技能被覆盖，且显示为“工作空间”标签。
- [ ] 运行打包命令（`pnpm run package`）后，打包输出的 Resources 目录下包含 `builtin-skills` 文件夹。
