# Chat Right Sidebar Spec

## ADDED Requirements

### Requirement: Provide A Collapsible Right Sidebar In The Chat Shell

聊天页 SHALL 提供一个可折叠的右侧边栏，并在聊天页右上角提供统一的折叠 / 展开入口。

#### Scenario: Collapse and expand from the top-right entry

- **GIVEN** 用户位于聊天页，无论当前子路由是 `workspace` 还是 `session`
- **WHEN** 用户点击位于右上角的右侧栏切换按钮
- **THEN** 右侧栏在展开与折叠状态之间切换
- **AND** 主内容区宽度相应调整
- **AND** 当前消息输入内容和会话滚动状态不因切换而丢失

### Requirement: Show Workspace Settings Sidebar In Workspace Context

当聊天页处于 `workspace` 上下文时，右侧栏 SHALL 展示工作空间设置面板。

#### Scenario: Render workspace settings groups

- **GIVEN** 当前路由为工作空间聊天入口
- **WHEN** 右侧栏处于展开状态
- **THEN** 右侧栏展示工作空间设置内容
- **AND** 内容以设置分组组织，而不是纯展示型空白页
- **AND** 至少包含工作空间基础信息、路径相关信息、`AGENTS.md` 设置和保存入口

### Requirement: Show Session Summary And Files Sidebar In Session Context

当聊天页处于 `session` 上下文时，右侧栏 SHALL 展示会话信息面板。

#### Scenario: Render session sidebar tabs

- **GIVEN** 当前路由为某个会话详情页
- **WHEN** 右侧栏处于展开状态
- **THEN** 右侧栏展示 `概要` 和 `文件` 两个主标签
- **AND** 默认标签和值的组织方式保持稳定、适合桌面工作台快速扫描

### Requirement: Move Todo Progress Into The Session Summary Panel

当前会话的 `TODO` 工具展示 SHALL 从输入区上方迁移到会话右侧栏的概要标签中。

#### Scenario: Show todo progress below session overview

- **GIVEN** 当前会话存在 `TODO` 数据
- **WHEN** 用户查看右侧栏的 `概要` 标签
- **THEN** 会话基础信息显示在前
- **AND** `TODO` 进度显示在其下方
- **AND** 输入区上方不再渲染悬浮式 `TODO` 进度块

#### Scenario: Hide empty todo section gracefully

- **GIVEN** 当前会话没有 `TODO` 数据
- **WHEN** 用户查看右侧栏的 `概要` 标签
- **THEN** 页面不展示误导性的空 `TODO` 容器
- **AND** 其余会话信息仍保持正常展示

### Requirement: Show Workspace File Tree In The Session Files Panel

`session` 右侧栏的 `文件` 标签 SHALL 展示当前工作空间的文件列表。

#### Scenario: Render workspace file tree

- **GIVEN** 当前会话关联到一个有效工作空间
- **WHEN** 用户切换到右侧栏的 `文件` 标签
- **THEN** 页面展示该工作空间根目录下的文件和文件夹树
- **AND** 用户可以展开或收起目录
- **AND** 文件列表数据来源不是当前会话上传附件

#### Scenario: Handle empty or unreadable workspace

- **GIVEN** 工作空间路径为空、目录不存在、目录不可读或目录中没有可展示内容
- **WHEN** 用户查看 `文件` 标签
- **THEN** 页面展示受控空态或错误态说明
- **AND** 说明文案应帮助用户理解当前为何无法展示文件

### Requirement: Preserve Stable Desktop Workbench Hierarchy

聊天页右侧栏改造 SHALL 遵守仓库 `DESIGN.md` 的桌面工作台设计标准。

#### Scenario: Keep the main chat area visually primary

- **GIVEN** 右侧栏已经展开
- **WHEN** 用户浏览聊天页
- **THEN** 消息内容区和输入区仍然是页面主视觉主体
- **AND** 右侧栏作为次级辅助区存在
- **AND** 页面使用克制边框、紧凑分组和稳定间距，而不是营销式视觉表达
