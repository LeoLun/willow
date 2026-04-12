# Design

## Scope

本次设计覆盖：

- 项目级 `DESIGN.md` 的章节结构与内容边界
- 与现有 `shadcn-vue` 配置、主题 token、组件目录的一致性要求
- AI 代理与前端工程师在 renderer 场景下的统一设计约束
- `AGENTS.md` 中对 `DESIGN.md` 的入口引用

本次不覆盖：

- renderer 现有页面或组件的视觉重构
- 主题 token 重命名或 CSS 变量扩展
- 新的组件库引入或字体资产变更

## Source Of Truth

`DESIGN.md` 的内容必须以仓库现有事实为前提：

- `components.json`
  - `style = new-york`
  - `baseColor = neutral`
  - `cssVariables = true`
- `app/work/src/renderer/index.css`
  - 已定义 `background / foreground / card / primary / muted / border / sidebar` 等核心 token
  - 已定义全局圆角、暗色变量和少量动效语义
- `app/work/src/renderer/src/components/ui/`
  - 已提供 Button、Card、Dialog、Sheet、Input、Textarea、Badge、Sidebar、Skeleton 等可复用基础组件

因此，`DESIGN.md` 只能整理、约束和解释这些既有事实，不能把不存在的 token、组件或页面模式写成默认要求。

## Document Architecture

`DESIGN.md` 固定使用以下章节组织：

1. Product UI Intent
2. Visual Foundation
3. Typography And Density
4. Layout Patterns
5. shadcn-vue Component Recipes
6. Interaction And States
7. Do / Don't
8. AI Prompt Contract

章节职责如下：

- Product UI Intent
  - 定义 Willow 的桌面工作台气质
  - 明确本规范适用范围和不适用范围
- Visual Foundation
  - 解释 token 来源、颜色角色和层级基线
- Typography And Density
  - 约束标题层级、正文密度、说明文长度和扫描性
- Layout Patterns
  - 提供页面级与容器级的标准骨架
- shadcn-vue Component Recipes
  - 为基础组件提供推荐用法与禁忌用法
- Interaction And States
  - 统一 loading / empty / error / destructive 等状态表达
- Do / Don't
  - 提供高信号设计判断准则
- AI Prompt Contract
  - 将上述约束转成可直接复用的 AI 指令模板

## Design Decisions

### Decision: 保持项目专属、工具型、非营销风格

`DESIGN.md` 必须明确 Willow renderer 的默认气质是：

- 冷静
- 专注
- 高信息密度但可扫描
- 面向桌面工作台的业务界面

必须避免：

- marketing landing page 风格
- 过度强调 hero 区、装饰渐变和大块情绪化文案
- 把设置页或列表页做成宣传页

### Decision: 现有 CSS variables 是唯一 token 来源

颜色、表面、边框、圆角和层级全部以 `app/work/src/renderer/index.css` 当前变量为准。

约束：

- 只允许引用现有 token 名称
- 文档可以解释 token 角色，不可以另立一套命名体系
- 暗色模式只说明兼容原则，不新增更多视觉要求

### Decision: 文档优先服务 AI 代理和工程师

`DESIGN.md` 不是纯品牌手册，而是执行手册。

必须具备：

- 可落地的页面骨架规则
- 组件使用顺序和操作层级
- AI 生成页面时可直接复用的提示模板

这意味着文档用语要偏实现导向，而不是偏抽象品牌叙事。

### Decision: 以常见桌面业务界面为默认模板

`Layout Patterns` 和 `Component Recipes` 重点覆盖：

- 列表页
- 设置页
- 空状态
- 弹窗表单
- 二次确认
- 侧边导航中的内容页

因为这些是 Willow 当前和短期内最常见的 renderer 交付形态。

## Content Rules For `DESIGN.md`

### Product UI Intent

必须明确：

- 适用于 Electron + Vue 的业务界面
- 默认是桌面工作台，不是品牌官网
- 追求秩序、清晰、效率和可读摘要

### Visual Foundation

必须覆盖：

- `background / card / primary / muted / border / sidebar` 的角色说明
- 圆角使用遵循现有 `--radius` 体系
- 边框、分割线和卡片层次优先轻量表达
- 阴影使用克制，不能让卡片悬浮感过重

### Typography And Density

必须覆盖：

- 页面标题、区块标题、正文、说明、标签文字的层级职责
- 默认密度偏紧凑，优先支持桌面高频扫描
- 限制单段说明过长和无意义留白

### Layout Patterns

必须覆盖：

- 页面头部结构：标题、说明、主操作区
- 内容容器宽度与区块间距的推荐节奏
- 列表页、空状态、表单页、Dialog / Sheet 的标准布局

### shadcn-vue Component Recipes

必须覆盖至少这些组件：

- `Button`
- `Card`
- `Dialog`
- `Sheet`
- `Input`
- `Textarea`
- `Select`
- `Badge`
- `Separator`
- `Skeleton`
- `Sidebar`

每个组件至少写清：

- 适合用在什么场景
- 默认层级或推荐组合
- 应避免的误用方式

### Interaction And States

必须覆盖：

- loading / empty / error / disabled / success / destructive
- hover、focus、selected 的一致性要求
- 动效保持轻量，只复用已有过渡语义

### Do / Don't

必须提供高信号准则，帮助实现者快速判断设计是否偏离项目风格。

### AI Prompt Contract

必须包含：

- 一段全局约束 prompt
- 一段列表页 prompt 模板
- 一段设置页或弹窗表单 prompt 模板

## Workflow Integration

需要在 `AGENTS.md` 做一处最小增补：

- renderer / shadcn-vue / 页面设计相关任务优先参考仓库根 `DESIGN.md`
- 同时保留 `docs/ai-workflows/openspec/` 作为需求与行为的唯一真相源

这样可以避免 `DESIGN.md` 被误认为替代 feature-level OpenSpec。

## Risks And Mitigations

### Risk: `DESIGN.md` 与代码事实脱节

Mitigation：

- 所有 token、组件和样式描述都必须能在当前仓库中找到对应来源
- 不写仓库里不存在的组件体系、排版资产或语义 token

### Risk: 文档过于抽象，无法指导实现

Mitigation：

- 每个章节都使用实现导向语言
- 必须包含页面骨架、组件配方和 prompt 模板

### Risk: 文档变成第二个产品真相源

Mitigation：

- 在 `DESIGN.md` 和 `AGENTS.md` 中明确其职责是长期 UI 约束
- feature-level 行为和需求依旧以 OpenSpec 为准
