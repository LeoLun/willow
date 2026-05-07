# skill-loading

技能加载模块的目录配置规范。

## 配置目录

- 技能配置目录名称为 `.agents`
- 全局技能路径：`<userData>/.agents/skills/`
- 项目技能路径：`<cwd>/.agents/skills/`

## 技能文件格式

- 每个技能是一个目录，目录下包含 `SKILL.md` 文件
- `SKILL.md` 使用 YAML frontmatter，必填 `description`，可选 `name`（默认取目录名）和 `disable-model-invocation`
- 递归搜索时跳过 `node_modules`、`.git`、`dist`、`build` 目录

## 技能合并规则

- 按 `realpath` 去重（符号链接解析后的真实路径）
- 按 `name` 去重，名称冲突时保留先加载的

## / 命令集成

- `loadSkills()` 是技能发现的唯一入口
- UI 层通过 IPC `GET_AVAILABLE_SKILLS` → `SkillService.getAvailableSkills()` → `loadSkills()` 获取技能列表
- `/` 斜杠命令的 ResourcePickerPanel 直接消费该列表，无需额外适配
