# Design

## Scope

本次设计覆盖：

- `@willow/ui` 独立 playground 的职责边界
- 单独 dev 模式的入口形式与工作区集成方式
- playground 与 `@willow/ui`、`app/work`、`DESIGN.md` 之间的关系
- playground 中样例组织、状态覆盖和样式基线要求

本次不覆盖：

- `@willow/ui` 内部组件的 API 重写
- Electron 主应用的业务路由改造
- 组件文档站、自动化截图测试或视觉回归平台接入

## Context

当前仓库的现状如下：

- `packages/ui` 是独立 workspace package，但没有单独的 dev 脚本
- `app/work` 的 renderer 通过 Vite alias 直接消费 `packages/ui/src`
- 仓库根 `pnpm dev` 只会进入 Electron 开发模式
- 组件样式调试必须依赖主应用环境，无法在纯前端上下文中快速验证

这意味着 `@willow/ui` 虽然在包结构上独立，但在开发体验上仍然从属于桌面应用。

## Design Principles

### Principle: 调试入口必须独立于 Electron，且直接面向浏览器

这次变更的关键不是“多一个页面”，而是“多一个单独的调试工作流”。

因此设计必须满足：

- 启动 playground 不需要 Electron 主进程
- 不需要业务数据库、IPC、workspace store 等运行条件
- 能通过单独命令启动 localhost Web 服务
- 开发者可以直接用浏览器打开调试页面进行热更新调试

### Principle: playground 只承载调试与示例，不承载业务行为

playground 的职责是：

- 展示组件与渲染器在典型输入下的样式表现
- 暴露常见边界状态以便快速检查
- 作为本地开发和视觉验收入口

playground 不负责：

- 模拟完整业务流程
- 替代正式页面需求验收
- 承担产品信息架构或真实数据联调

### Principle: 视觉基线遵循 `DESIGN.md`

根据仓库约定，renderer、`shadcn-vue` 和页面设计工作都应参考根目录 `DESIGN.md`。

因此 playground 虽然是独立入口，也必须：

- 复用现有样式 token 和基础 CSS 约束
- 保持冷静、工具型、便于扫描的桌面工作台风格
- 避免为了“示例展示”引入偏营销化或脱离项目气质的页面设计

## Architecture Decision

### Decision: 采用独立 localhost playground，而不是主应用内调试路由

推荐为 `@willow/ui` 增加一个独立的 Vite + Vue playground 入口，启动 localhost Web 服务，作为 workspace 中的轻量 Web 调试模块。

原因：

- 它直接满足“单独运行 dev 模式并网页打开调试”
- 启动速度和调试闭环明显优于 Electron 容器
- 可以把样例组织、状态切换和布局壳控制在最小范围内
- 不会把测试页错误地耦合进主应用导航和业务依赖

约束：

- playground 只能消费 `@willow/ui` 的公开导出或明确允许的开发入口
- 不应复制 `app/work` 的页面骨架来伪装成业务页面
- 不应引入与主应用冲突的第二套主题来源

### Decision: playground 使用固定样例数据驱动展示

playground 页面应以静态或本地构造的数据驱动，而不是依赖真实 agent 会话。

至少要支持以下类型的展示样例：

- 用户消息、助手消息、流式消息
- Markdown / code block / console block
- 工具调用渲染与调试块
- 折叠内容、长内容、多段内容
- 空状态、加载态、错误态等典型视觉状态

这样可以确保开发者快速复现样式问题，而无需准备完整运行链路。

### Decision: playground 需要稳定的场景导航结构

为避免测试页变成一大块难以维护的临时代码，playground 应当具备清晰的场景组织方式。

推荐组织方式：

- 左侧或顶部使用轻量导航列出 demo 分类
- 内容区一次聚焦一个组件或一组相关场景
- 每个 demo 有明确标题、短说明和样例容器

这既符合 `DESIGN.md` 的桌面工作台风格，也便于后续继续扩展。

### Decision: 单独 dev 命令必须成为显式工作流入口，并输出可访问的 localhost 地址

仓库需要提供一个清晰可发现的命令来启动 playground 本地服务。

命令要求：

- 命名应直接表达 `ui` / `playground` / `dev` 的意图
- 不覆盖现有根 `pnpm dev` 的 Electron 语义
- 启动后提供稳定的 localhost 访问地址
- 适合在 README、计划文档或后续 AGENTS 说明中直接引用

## Data And Dependency Boundaries

playground 应避免依赖以下运行时能力：

- Electron API
- IPC 桥接
- 数据库或本地文件系统状态
- 业务 store 的初始化流程

playground 可以依赖：

- Vue
- Vite
- `@willow/ui`
- 组件运行所需的最小 peer dependency
- 样式系统与图标等前端运行时依赖

playground 默认交付形式应为：

- 本地开发时由 Vite 或等价前端 dev server 提供 localhost 服务
- 用系统浏览器或手动浏览器访问方式进行查看
- 不要求把该页面嵌入 Electron 窗口中

如果某些 `@willow/ui` 组件依赖外部类型或 renderer registry，playground 需要以 mock 数据或最小注册方式解决，而不是把整个业务环境搬进来。

## UX Structure

### Playground Shell

playground 页面建议采用工具型结构：

- 页面头部：名称、用途说明、必要的场景切换入口
- 导航区：按组件类别或消息类别组织 demo
- 主内容区：展示当前 demo，并保留足够空间观察布局和状态

### Demo Card

每个 demo 区块至少包含：

- 标题
- 一句简短说明
- 样例渲染区域

可选内容：

- 变体切换
- 状态切换
- mock 数据切换

### Visual Rules

playground 自身界面也要遵循以下规则：

- 使用现有 token、边框和卡片层次，而不是额外做一套炫技展示页
- 保持信息密度适中，方便多组件连续检查
- 组件示例应优先展示真实使用尺寸与容器环境

## Risks And Mitigations

### Risk: playground 很快变成第二个业务壳

Mitigation：

- 明确其职责只限组件样例和样式调试
- 禁止接入业务路由、业务 store 和 IPC 行为

### Risk: 样例代码分散、难维护

Mitigation：

- 以 demo registry、分类配置或等价集中方式组织样例
- 每个 demo 只表达一个明确的视觉目的

### Risk: playground 样式与主应用逐渐漂移

Mitigation：

- 复用 `@willow/ui` 样式入口
- 设计和页面壳遵循仓库根 `DESIGN.md`
- 避免为 playground 单独发明新 token 或特殊主题

### Risk: 独立入口仍然暗中依赖主应用构建配置

Mitigation：

- 在实现阶段显式梳理 playground 所需 alias、CSS 和依赖
- 以最小前端运行环境为目标，而不是复制 `app/work` 的整个 Vite 配置
