# UI Playground Spec

## ADDED Requirements

### Requirement: 为 `@willow/ui` 提供基于 localhost 的独立调试入口

项目必须为 `@willow/ui` 提供一个可单独启动的 localhost playground 或等价测试页面，用于本地开发时通过浏览器调试组件样式与展示效果。

#### Scenario: 单独启动 UI playground

- **GIVEN** 开发者正在修改 `packages/ui` 中的组件或样式
- **WHEN** 开发者执行项目提供的 UI playground dev 命令
- **THEN** 开发者可以在不启动 Electron 主应用的情况下启动本地 Web 服务并访问组件测试页面
- **AND** 该调试页面可以通过 localhost 地址在浏览器中直接打开
- **AND** 该页面可以热更新展示 `@willow/ui` 的最新改动

### Requirement: playground 必须与 Electron 运行时解耦

UI playground 必须在纯前端运行环境中工作，不依赖主进程、IPC 或业务 store 初始化。

#### Scenario: 脱离桌面应用容器运行

- **GIVEN** 本地环境没有启动 `app/work` 的 Electron 开发进程
- **WHEN** 开发者打开 playground
- **THEN** playground 仍然可以正常加载并渲染示例组件
- **AND** 不要求数据库、窗口管理或其他桌面应用运行时能力
- **AND** 开发者通过浏览器而不是 Electron 窗口访问该页面

### Requirement: playground 应覆盖代表性 UI 场景

UI playground 必须提供足够的样例场景，以支持 `@willow/ui` 核心组件和渲染器的样式调试。

#### Scenario: 查看代表性消息与渲染器样例

- **GIVEN** 开发者需要验证消息组件与工具渲染器的视觉表现
- **WHEN** 开发者浏览 playground
- **THEN** 可以查看至少一组代表性的消息、工具调用或内容块示例
- **AND** 这些示例覆盖真实开发中常见的视觉形态

#### Scenario: 查看边界状态

- **GIVEN** 开发者需要检查 UI 组件在边界输入下的样式稳定性
- **WHEN** 开发者切换到长内容、折叠内容、空态、加载态或错误态 demo
- **THEN** playground 提供相应示例以支持样式和布局验证

### Requirement: playground 必须复用 `@willow/ui` 的真实实现

UI playground 必须消费 `@willow/ui` 的真实组件和样式入口，而不是复制一套平行实现。

#### Scenario: 组件改动可以立即反映

- **GIVEN** 开发者修改了 `packages/ui/src` 中的组件、样式或渲染逻辑
- **WHEN** playground 重新渲染相关 demo
- **THEN** 页面展示的就是当前 `@willow/ui` 的真实实现效果
- **AND** 不需要同步维护另一份示例组件副本

### Requirement: playground 的页面壳遵循项目设计基线

UI playground 本身必须遵循仓库根 `DESIGN.md` 的 renderer 设计约束，保持与项目整体视觉语言一致。

#### Scenario: 使用统一设计标准组织 demo

- **GIVEN** 开发者在 playground 中查看多个组件或 demo 分组
- **WHEN** playground 展示导航、标题、卡片和内容区
- **THEN** 页面结构保持冷静、工具型、可扫描的桌面工作台风格
- **AND** 不引入与现有 token 和 `shadcn-vue` 基线冲突的新视觉体系
