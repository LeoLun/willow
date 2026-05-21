# 提案：内置技能目录实现

## 动机

当前 Willow 系统仅支持加载全局用户技能（`~/.agents/skills`）与工作空间/项目技能（`项目目录/.agents/skills`）。然而，对于 Willow 桌面应用本身内置的常用技能，无法直接在代码库中进行统一管理和打包分发。通过在代码库中指定一个内置技能目录，我们可以将一些通用技能作为内置技能直接集成到应用中，随应用一同打包，供所有用户和工作空间免配置使用。

## 目标

1. 在代码库中指定一个内置技能目录（`app/work/builtin-skills`）。
2. 在该目录下的技能都被识别为内置技能。
3. 加载逻辑将内置技能与全局技能、工作空间技能融合。
4. 内置技能的优先级最低，即同名技能下，用户技能和工作空间技能会覆盖内置技能。
5. 在 UI 层面，内置技能的范围标签显示为“内置”。

## 范围

- **内置技能存放**：在 `app/work/builtin-skills` 中存放内置技能。
- **构建与打包配置**：修改 `app/work/forge.config.mjs` 中的 `extraResource` 配置，确保应用打包时能将 `builtin-skills` 目录拷贝到 Resources 中。
- **技能加载逻辑**：
  - 修改 `@willow/core` 中的 `loadSkills()`，使其支持 `builtinDir` 参数，并能加载该目录下的 `SKILL.md` 技能。
  - 修改 `loadSkills()` 的冲突合并逻辑，当发生名称冲突时，内置技能（最低优先级）被全局和项目技能覆盖。
- **主进程服务**：
  - 修改 `SkillService` 和 `AgentService`，计算出正确的 `builtinDir` 路径（区分开发环境 `app.getAppPath()` 和打包环境 `process.resourcesPath`），并传递给 `loadSkills()`。
  - 在 `SkillService` 中增加对内置技能 scope label 的特殊解析（即“内置”）。

## 非范围

- 不改变现有全局技能与工作空间技能的目录结构。
- 不影响已有的技能加载报错提示。
