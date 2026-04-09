## ADDED Requirements

### Requirement: The system SHALL persist automation records with workspace and prompt settings
系统必须支持创建和保存自动化记录，使每条自动化至少包含名称、目标工作空间、自定义提示词、启用状态、触发器类型、触发器配置和执行模式。

#### Scenario: Creating a new automation
- **WHEN** 用户提交一条新的自动化配置
- **THEN** 系统会保存该自动化的名称、工作空间、提示词、触发器设置、执行模式和启用状态

#### Scenario: Storing the selected execution mode
- **WHEN** 用户在创建自动化时选择“创建新会话”或“复用固定会话”
- **THEN** 系统会将该执行模式持久化到自动化记录中

### Requirement: Scheduled automation forms SHALL accept standard cron expressions
系统必须在定时自动化创建与编辑界面中使用标准 cron 表达式作为计划定义方式，而不是自定义定时器字段组合。

#### Scenario: Entering a cron expression
- **WHEN** 用户配置一条定时自动化
- **THEN** 界面会提供标准 cron 表达式输入，并将其保存到触发器配置中

### Requirement: The automation form SHALL provide preset schedule modes for common cases
系统必须在自动化表单中为常见定时场景提供预设模式，以减少用户直接编写 cron 的门槛。

#### Scenario: Configuring a daily schedule
- **WHEN** 用户选择“每天”
- **THEN** 界面会要求输入一个时间，并基于该时间生成对应的标准 cron 表达式

#### Scenario: Configuring an hourly schedule
- **WHEN** 用户选择“每小时”
- **THEN** 界面会使用整点执行的规则生成对应的标准 cron 表达式，而不要求用户额外输入时间

#### Scenario: Configuring a weekly schedule
- **WHEN** 用户选择“每周”
- **THEN** 界面会要求输入星期几和时间，并基于这些值生成对应的标准 cron 表达式

#### Scenario: Falling back to custom cron
- **WHEN** 用户选择“自定义”
- **THEN** 界面会显示 cron 表达式输入框，并允许用户直接填写原始表达式

### Requirement: The system SHALL allow selecting a workspace for each automation
系统必须要求每条自动化绑定一个工作空间，并在创建或编辑时让用户从现有工作空间列表中选择目标工作空间。

#### Scenario: Choosing a target workspace
- **WHEN** 用户打开自动化创建或编辑界面
- **THEN** 界面会提供可选的工作空间列表，并允许用户选定其中一个作为目标工作空间

#### Scenario: Displaying the bound workspace in the list
- **WHEN** 自动化列表中存在已创建的自动化
- **THEN** 每条自动化项都会展示其绑定的工作空间信息

### Requirement: The automation page SHALL show an empty-state guide when no automation exists
系统必须在自动化列表为空时展示明确的空态引导，帮助用户理解自动化用途并开始创建第一条自动化。

#### Scenario: Rendering the empty state
- **WHEN** 用户进入自动化页面且当前没有任何自动化记录
- **THEN** 页面会展示空态说明和可执行的创建入口

### Requirement: The automation page SHALL provide a visible create action in the header
系统必须在自动化页面右上角提供清晰可见的“添加自动化”操作入口，不依赖空态才能开始创建。

#### Scenario: Rendering the create button in a populated list
- **WHEN** 用户进入已有自动化数据的自动化页面
- **THEN** 页面右上角仍然会显示“添加自动化”按钮

### Requirement: The automation page SHALL list existing automations with key status information
系统必须展示已创建的自动化列表，并让用户能够从列表中理解每条自动化的名称、工作空间、触发方式、执行模式、启用状态和最近执行摘要。

#### Scenario: Rendering automation summary information
- **WHEN** 自动化页面加载已有自动化记录
- **THEN** 页面会按列表形式展示每条自动化的关键摘要信息，而不要求用户进入详情页才能理解其基本状态

### Requirement: New automation creation SHALL default to creating a new session
系统必须在自动化创建界面中默认选择“创建新会话”作为执行模式，同时允许用户显式切换为“复用固定会话”。

#### Scenario: Opening the create form
- **WHEN** 用户首次打开自动化创建界面
- **THEN** 执行模式会默认选中“创建新会话”

#### Scenario: Switching to reuse mode
- **WHEN** 用户在创建或编辑自动化时改选“复用固定会话”
- **THEN** 系统会接受该选择并将其作为该自动化的执行模式保存

### Requirement: The system SHALL expose automation management capabilities as AI-usable tools
系统必须将自动化的查询、查看、更新和删除能力封装为 Agent 可调用的工具，以便 AI 能在会话中直接管理已有自动化记录。

#### Scenario: Listing automations from AI
- **WHEN** Agent 需要了解当前已有自动化
- **THEN** 系统会提供可调用的自动化列表工具，并返回包含关键摘要信息的结果

#### Scenario: Reading automation details from AI
- **WHEN** Agent 需要查看某条自动化的完整配置
- **THEN** 系统会提供可调用的自动化详情工具，并返回该自动化的结构化配置数据

#### Scenario: Updating an automation from AI
- **WHEN** Agent 发起对某条自动化的修改
- **THEN** 系统会通过自动化更新工具执行该操作，并沿用现有写操作审批机制

#### Scenario: Deleting an automation from AI
- **WHEN** Agent 发起删除某条自动化的请求
- **THEN** 系统会通过自动化删除工具执行该操作，并沿用现有写操作审批机制

### Requirement: AI-driven automation creation SHALL produce a preview draft before persistence
系统必须让 AI 在处理创建自动化请求时先生成结构化预览草稿，而不是直接持久化真实自动化记录。

#### Scenario: Generating an automation draft
- **WHEN** 用户在聊天中请求创建一条新的自动化
- **THEN** Agent 会返回包含名称、触发配置、提示词、执行模式和预览摘要的结构化草稿结果

#### Scenario: Rendering a preview card for a draft
- **WHEN** 聊天中收到自动化创建草稿结果
- **THEN** 界面会把该结果渲染成可操作的自动化预览卡片，而不是只显示原始 JSON 文本

### Requirement: Preview-card confirmation SHALL open the automation form with AI-provided defaults
系统必须支持用户从自动化预览卡片进入正式创建流程，并将 AI 生成的草稿内容预填到现有自动化表单中。

#### Scenario: Opening the form from a preview card
- **WHEN** 用户点击自动化预览卡片上的“创建”按钮
- **THEN** 系统会打开现有自动化创建表单，并将草稿内容作为默认值带入

#### Scenario: Confirming creation after editing draft defaults
- **WHEN** 用户在预填表单中调整部分字段后提交
- **THEN** 系统会使用用户最终确认的表单值创建真实自动化记录，而不是直接使用未经确认的草稿原值
