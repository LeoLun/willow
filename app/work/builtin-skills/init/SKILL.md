---
name: init
description: 分析当前工作空间并创建或改进 AGENTS.md，完成工作空间 Agent 元信息初始化。
---

# /init

分析当前项目工作空间的结构和内容，自动生成或改进 `AGENTS.md` 文件，完成工作空间 Agent 元信息初始化。

## 使用条件

- 仅能在**项目工作空间**中使用，对话工作空间不可用。

## 行为

1. 扫描工作空间根目录的关键文件（`package.json`、`pnpm-workspace.yaml`、`README.md`、`DESIGN.md` 等）。
2. 收集当前可用的技能列表（全局、工作空间、内置）。
3. 使用 LLM 生成或改进 `AGENTS.md`，包含：
   - 工作空间概览与作用
   - 技能与工具入口索引
   - 必须文件索引
   - 触发定义与协作约束
4. 将生成的内容写入工作空间的 `AGENTS.md`。
5. 刷新工作空间 Agent 元信息。

## 最终步骤：确保 Frontmatter

在完成 `AGENTS.md` 内容生成或改进后，**必须**执行以下脚本为 `AGENTS.md` 添加或更新 YAML frontmatter：

```bash
node <本技能目录>/scripts/ensure-frontmatter.js <AGENTS.md 路径> <name> <description>
```

参数说明：
- `<AGENTS.md 路径>`：工作空间根目录下的 `AGENTS.md` 绝对路径。
- `<name>`：工作空间 Agent 的名称（例如 `"Willow 工作空间 Agent"`）。
- `<description>`：工作空间 Agent 的触发描述，需说明何时触发、触发效果。

示例：

```bash
node <本技能目录>/scripts/ensure-frontmatter.js /path/to/project/AGENTS.md "MyProject 工作空间 Agent" "当任务属于 MyProject 仓库的代码、文档、配置范围时触发；触发后在该工作空间内分析、修改并验证结果。"
```

> 注意：`<本技能目录>` 需替换为本 SKILL.md 所在目录的实际路径。脚本会自动处理三种场景：文件不存在时创建、文件无 frontmatter 时插入、已有 frontmatter 时更新字段。
