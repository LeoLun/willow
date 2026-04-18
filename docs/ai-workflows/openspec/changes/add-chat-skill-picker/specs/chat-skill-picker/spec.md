# Chat Skill Picker Spec

## ADDED Requirements

### Requirement: Provide A Tiptap-Based Chat Composer

聊天输入区 SHALL 使用基于 Tiptap 的编辑器替代当前普通文本域，同时保持现有核心发送能力可用。

#### Scenario: Keep existing send controls available

- **GIVEN** 用户位于聊天页输入区
- **WHEN** 页面完成渲染
- **THEN** 输入区使用 Tiptap 编辑器承载消息输入
- **AND** 发送 / 停止按钮、模型选择、联网开关仍然可用
- **AND** 现有 token 用量展示行为不因编辑器升级而丢失

#### Scenario: Render the composer as a single integrated shell

- **GIVEN** 用户查看聊天输入区
- **WHEN** 输入器完成渲染
- **THEN** 输入区表现为单个一体式圆角容器
- **AND** 已选技能显示在容器顶部区域
- **AND** 编辑区位于中部
- **AND** 底部控制条与发送按钮位于同一容器内

#### Scenario: Send plain text from the editor

- **GIVEN** 用户在编辑器中输入普通文本，且没有选择任何技能
- **WHEN** 用户执行发送
- **THEN** 系统发送编辑器的纯文本内容
- **AND** 行为与当前普通聊天发送保持一致

#### Scenario: Prevent empty message submission

- **GIVEN** 编辑器中没有可发送的文本内容
- **WHEN** 用户执行发送
- **THEN** 系统阻止空消息提交
- **AND** 不会发送只包含空白结构的编辑器内容

### Requirement: Expose Global And Workspace Skills In The Composer

聊天输入区 SHALL 在同一处交互中展示全局技能与当前工作空间技能，并允许用户为当前消息显式选择技能。

#### Scenario: Show grouped skills when workspace exists

- **GIVEN** 当前聊天上下文关联到有效工作空间
- **WHEN** 用户打开输入区技能入口
- **THEN** 系统展示 `全局技能` 与 `当前工作空间技能` 两个分组
- **AND** 每个技能项至少展示名称与简短描述

#### Scenario: Show only global skills without workspace context

- **GIVEN** 当前聊天上下文尚未关联工作空间
- **WHEN** 用户打开输入区技能入口
- **THEN** 系统仍展示可用的全局技能
- **AND** 当前工作空间技能分组不会以误导方式展示为空列表

#### Scenario: Reflect selection in the composer

- **GIVEN** 用户在技能入口中选中了一个或多个技能
- **WHEN** 用户返回输入区继续编辑消息
- **THEN** 输入区以顶部胶囊标签或等价结构展示已选技能
- **AND** 用户可以在发送前移除任一已选技能

#### Scenario: Search skills with slash query

- **GIVEN** 用户正在聊天输入区编辑消息
- **WHEN** 用户输入以 `/` 开头的技能搜索查询，例如 `/sp`
- **THEN** 系统展示匹配的技能结果列表
- **AND** 结果会根据查询内容实时过滤
- **AND** 用户无需离开输入器即可完成技能选择

#### Scenario: Show source label at the end of each search result

- **GIVEN** 用户正在查看技能搜索结果
- **WHEN** 结果项被渲染
- **THEN** 每一项末尾都展示明确来源标识
- **AND** 来自全局技能目录的项显示 `全局`
- **AND** 来自当前工作空间技能目录的项显示 `工作空间`

#### Scenario: Convert slash query into selected skill

- **GIVEN** 用户通过 slash 搜索高亮或点击了某个技能结果
- **WHEN** 用户确认选择
- **THEN** 搜索查询文本不会作为普通正文保留
- **AND** 该技能转为输入区顶部的已选胶囊
- **AND** 输入器回到正常正文编辑状态

### Requirement: Apply Selected Skills Only To The Current Message

系统 SHALL 将用户显式选择的技能仅应用于当前发送消息，而不是隐式延续到后续所有轮次。

#### Scenario: Clear selected skills after successful send

- **GIVEN** 用户已经选择技能并成功发送当前消息
- **WHEN** 输入区进入下一轮待输入状态
- **THEN** 上一轮已选技能被清空
- **AND** 用户需要重新选择下一轮要显式启用的技能

#### Scenario: Keep selected skills while the current draft is unsent

- **GIVEN** 用户已经选择技能但尚未发送
- **WHEN** 用户继续编辑当前消息文本
- **THEN** 已选技能保持不变
- **AND** 直到用户主动移除或完成发送前不会丢失

### Requirement: Send Selected Skills As Structured Message Context

系统 SHALL 把本轮选中技能作为结构化数据进入发送链路，并在主进程中转成受控提示上下文。

#### Scenario: Include selected skills in the send payload

- **GIVEN** 用户为当前消息选择了技能
- **WHEN** renderer 发起消息发送
- **THEN** 发送请求除正文外还包含选中技能的结构化标识信息
- **AND** 该信息不依赖从正文字符串中反向解析

#### Scenario: Revalidate selected skills before prompting the agent

- **GIVEN** renderer 传入了选中技能
- **WHEN** 主进程准备调用 agent
- **THEN** 主进程重新校验这些技能仍属于当前可用技能集合
- **AND** 校验通过的技能被组装进本轮 prompt 上下文
- **AND** 不会把未校验通过的技能直接信任为可执行上下文

#### Scenario: Degrade gracefully when some skills become unavailable

- **GIVEN** 用户选择的部分技能在发送前已经失效、被移除或不再属于当前工作空间
- **WHEN** 主进程执行发送
- **THEN** 系统对失效技能做受控忽略或错误提示
- **AND** 若正文仍然有效，普通聊天发送可以继续完成

### Requirement: Keep The Composer Consistent With The Desktop Workbench Design

输入区改造 SHALL 遵守仓库根目录 `DESIGN.md` 的桌面工作台设计规范。

#### Scenario: Keep the composer compact and tool-like

- **GIVEN** 用户查看聊天输入区
- **WHEN** Tiptap 编辑器和技能入口被渲染
- **THEN** 输入区保持紧凑、稳定、工具型结构
- **AND** 不出现营销化富文本工具栏或过度装饰的编辑器样式
- **AND** 主发送动作仍保持最清晰的操作层级

#### Scenario: Align with the provided visual reference

- **GIVEN** 产品实现以用户提供的输入框示意为参考
- **WHEN** 输入区完成最终视觉落地
- **THEN** 页面保持“顶部技能胶囊 + 中部编辑区 + 底部控制条 + 右侧主发送按钮”的骨架
- **AND** 技能区、编辑区和操作区不会被拆成多个松散卡片
- **AND** 输入器整体观感仍符合仓库 `DESIGN.md` 的桌面工作台规范
