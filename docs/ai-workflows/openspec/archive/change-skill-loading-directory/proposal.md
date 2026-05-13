# change-skill-loading-directory

## Summary

将技能（skill）加载目录从 `.willow/skills` 改为 `.agents/skills`，保证 `/` 斜杠命令的技能选择功能正常工作。

## Problem

当前 `packages/core/src/skills.ts` 中硬编码 `WILLOW_CONFIG_DIR = ".willow"`，技能加载路径为：

- 全局技能：`<userData>/.willow/skills/`
- 项目技能：`<cwd>/.willow/skills/`

但项目中实际存放技能的目录是 `.agents/skills/`（Claude Code 原生机制），`.willow/skills/` 目录并不存在。同时希望统一使用 `.agents` 作为配置目录名。

## Goals

- 将技能加载目录从 `.willow` 改为 `.agents`
- `/` 斜杠命令的技能选择（ResourcePickerPanel）继续正常工作
- 全局技能和项目技能的发现路径均使用 `.agents/skills/`

## Non-Goals

- 不改变技能文件格式（SKILL.md + YAML frontmatter）
- 不改变技能合并去重逻辑
- 不改变 UI 层的技能选择交互
- 不改变 CSS 类名中的 `willow-` 前缀（属于组件样式，与技能目录无关）

## Success Criteria

- `loadSkills()` 从 `.agents/skills/` 读取技能
- `/` 斜杠命令触发后，ResourcePickerPanel 正确列出技能
- 全局和项目技能均能正常加载

## Recommendation

直接修改 `WILLOW_CONFIG_DIR` 常量值。`/` 斜杠命令的完整链路（SenderContainer → IPC → SkillService → loadSkills → ResourcePickerPanel）均通过 `loadSkills()` 获取技能列表，改一处即可全局生效。

## Next Step

进入 `workflow-worktree` 或 `workflow-plan` 开始实现。
