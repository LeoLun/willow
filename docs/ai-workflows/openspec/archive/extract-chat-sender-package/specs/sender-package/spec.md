# Sender Package Spec

## ADDED Requirements

### Requirement: Provide The Chat Sender As A Shared Workspace Package

系统 SHALL 将聊天发送器提供为 `packages/` 下的共享 workspace 包 `@willow/sender`，而不是仅存在于 `app/work` renderer 本地目录中。

#### Scenario: Expose sender through package entry

- **GIVEN** 仓库完成本次变更
- **WHEN** 开发者查看 `packages/` 下的共享包
- **THEN** 存在独立的 `@willow/sender` 包
- **AND** 该包具备明确的入口导出
- **AND** 宿主应用可以通过包名导入发送器，而不是通过 `app/work` 内部文件路径导入

#### Scenario: Keep sender implementation out of app-local path

- **GIVEN** `app/work` 需要渲染聊天发送器
- **WHEN** renderer 引入发送器组件
- **THEN** 它通过 `@willow/sender` 消费共享实现
- **AND** 不再依赖旧的本地 `sender/index.vue` 作为主实现来源

### Requirement: Keep Shared Package Free From app/work Runtime Coupling

`@willow/sender` SHALL 不直接耦合 `app/work` 的运行时依赖，而应通过宿主注入数据与行为。

#### Scenario: No direct dependency on Electron IPC

- **GIVEN** `@willow/sender` 被构建或复用
- **WHEN** 检查其源码依赖
- **THEN** 包内不会直接访问 `window.electronAPI`
- **AND** 技能数据等外部信息由宿主通过 props 或事件流提供

#### Scenario: No direct dependency on router or store

- **GIVEN** `@willow/sender` 被用于不同宿主
- **WHEN** 检查其源码依赖
- **THEN** 包内不会直接依赖 `vue-router` 或 `pinia`
- **AND** 模型数据、默认模型和“前往设置”行为均由宿主注入

#### Scenario: No reverse import from app/work source

- **GIVEN** `@willow/sender` 位于 `packages/`
- **WHEN** 检查其模块导入
- **THEN** 包内不会反向导入 `app/work/src/` 下的源码模块
- **AND** 不会依赖 `@/` 这类仅对 `app/work` 生效的路径别名

### Requirement: Preserve Sender Core Experience In app/work

迁移到 `@willow/sender` 后，`app/work` 中发送器的核心体验 SHALL 保持可用，不得因包拆分而出现明显功能回退。

#### Scenario: Keep composer interaction available after migration

- **GIVEN** 用户位于 `app/work` 聊天页
- **WHEN** 发送器通过 `@willow/sender` 渲染
- **THEN** 用户仍可输入文本、选择技能、切换模型、切换联网开关
- **AND** 用户仍可执行发送与停止

#### Scenario: Keep usage indicator available

- **GIVEN** 当前会话存在模型上下文窗口信息且允许展示 usage
- **WHEN** 用户查看发送器底部控制区
- **THEN** token 用量展示仍可正常渲染
- **AND** 不因组件拆包而丢失

#### Scenario: Keep selected-skill flow available

- **GIVEN** 用户在发送器中打开技能入口或通过 slash 搜索技能
- **WHEN** 用户选择、移除并发送技能增强消息
- **THEN** 已选技能胶囊、搜索结果、发送后清空等行为保持可用

### Requirement: Define A Stable Host Integration API

`@willow/sender` SHALL 通过稳定的公共 API 与宿主集成，使宿主能够注入模型、技能、状态与交互副作用。

#### Scenario: Host provides models and skill options

- **GIVEN** 宿主应用需要渲染发送器
- **WHEN** 宿主向 `@willow/sender` 提供输入数据
- **THEN** 宿主可以传入模型列表、默认模型、技能列表及其加载状态
- **AND** 发送器无需自行感知这些数据来自 store、IPC 或其他来源

#### Scenario: Sender emits structured send intent

- **GIVEN** 用户在发送器内完成输入并触发发送
- **WHEN** `@willow/sender` 通知宿主
- **THEN** 发送器以结构化 payload 发出 `send` 意图
- **AND** payload 至少包含正文、选中技能、模型标识与联网开关状态

#### Scenario: Host handles settings navigation

- **GIVEN** 发送器需要引导用户前往设置页处理模型配置
- **WHEN** 用户触发对应操作
- **THEN** `@willow/sender` 发出显式事件或调用宿主提供的回调
- **AND** 实际导航由宿主执行

### Requirement: Keep The Sender Compatible With Willow Design Tokens

`@willow/sender` SHALL 继续兼容 Willow 当前基于 `shadcn-vue` 和 renderer token 的视觉体系。

#### Scenario: Consume existing design tokens instead of defining a new theme

- **GIVEN** `@willow/sender` 被接入 Willow renderer
- **WHEN** 组件渲染其输入容器、菜单、胶囊和按钮
- **THEN** 它继续消费现有 token 与 `@willow/shadcn` 组件
- **AND** 不会引入平行的全局主题系统

#### Scenario: Preserve workbench-style integrated layout

- **GIVEN** 用户查看迁移后的聊天发送器
- **WHEN** 组件完成渲染
- **THEN** 发送器仍保持“一体式圆角输入容器”的工作台结构
- **AND** 继续呈现顶部技能区、中部编辑区、底部控制条与右侧主发送按钮的骨架
