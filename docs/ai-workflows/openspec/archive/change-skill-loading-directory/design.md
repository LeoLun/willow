# design

## 改动范围

仅修改 `packages/core/src/skills.ts` 第 6 行的常量：

```
- const WILLOW_CONFIG_DIR = ".willow";
+ const WILLOW_CONFIG_DIR = ".agents";
```

## 影响分析

`WILLOW_CONFIG_DIR` 在 `loadSkills()` 中被用于两处：

1. **全局技能目录**（line 120）：`join(options.userData, WILLOW_CONFIG_DIR)` → `<userData>/.agents`
2. **项目技能目录**（line 127）：`join(cwd, WILLOW_CONFIG_DIR, "skills")` → `<cwd>/.agents/skills`

`/` 斜杠命令的调用链无需改动：

```
用户输入 "/" 
  → ResourcePickerPanel 显示技能列表
    → SenderContainer 调用 electronAPI.getAvailableSkills()
      → IPC GET_AVAILABLE_SKILLS
        → SkillService.getAvailableSkills()
          → loadSkills({ cwd, userData })
            → 从 .agents/skills/ 读取 SKILL.md
```

## 不影响的部分

- CSS 类名中的 `willow-` 前缀（`willow-code-block`、`willow-skill-tag`、`willow-file-tag`、`willow-md-editor-content`、`willow-shimmer`）：这些是组件样式命名，与技能加载目录无关
- `app/work/src/main/main.ts` 中的 `com.willow.work`：Electron 应用标识符
- SkillTag、FileTag 等 Tiptap 扩展
