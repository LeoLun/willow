# 2026-05-07-change-skill-loading-directory

## 变更概述

将技能加载的配置目录常量从 `".willow"` 改为 `".agents"`，使 `loadSkills()` 从实际存在的 `.agents/skills/` 目录加载技能。

## 执行步骤

### Step 1: 修改常量

**文件**: `packages/core/src/skills.ts`，第 6 行。

**改动内容**:

```diff
- const WILLOW_CONFIG_DIR = ".willow";
+ const WILLOW_CONFIG_DIR = ".agents";
```

该常量被三处引用，改一处全局生效：
- Line 120: `<userData>/.agents/` — 全局技能目录（用户数据目录）
- Line 124: `<homedir>/.agents/` — 全局技能目录（用户主目录回退）
- Line 127: `<cwd>/.agents/skills/` — 项目技能目录

### Step 2: 验证

```bash
pnpm lint    # 确保 ESLint 无报错
pnpm build   # 确保项目构建通过
```

### Step 3: 手动功能验证

1. 启动应用，在输入框输入 `/` 触发斜杠命令
2. 确认 ResourcePickerPanel 正确列出 `.agents/skills/` 中的技能
3. 确认选中技能后可正常插入到输入框

## 依赖与阻塞

- 无外部依赖
- `.agents/skills/` 目录已存在且包含技能文件（已验证）

## 停止条件

- `pnpm lint` 和 `pnpm build` 通过
- `/` 命令技能选择功能正常工作
