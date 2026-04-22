# 自动化规格增量：立即执行

## ADDED Requirements

### Requirement: Trigger Automation Manually From Detail Page

系统必须允许用户在自动化详情页右上角手动立即触发当前自动化执行一次。

#### Scenario: Show run-now action

- **前提** 用户打开一条已存在的自动化详情页
- **当** 自动化详情加载完成
- **那么** 页面右上角操作区展示“立即执行”按钮
- **并且** 该按钮视觉层级低于保存操作
- **并且** 该按钮符合仓库根 `DESIGN.md` 的 renderer 工具型按钮规范

#### Scenario: Run automation immediately

- **前提** 用户打开一条已存在且启用的自动化详情页
- **并且** 当前表单没有未保存修改
- **并且** 当前表单状态有效
- **当** 用户点击“立即执行”
- **那么** 系统立即使用该自动化已保存的工作空间、模型和提示词触发一次执行
- **并且** 系统为本次执行创建会话并启动 AI 发送流程
- **并且** 不等待下一次 cron 计划点
- **并且** 不改变该自动化的 cron 表达式、启停状态或后续定时注册

#### Scenario: Navigate to execution session after start

- **前提** 用户点击“立即执行”
- **并且** 主进程已经创建本次执行会话并启动执行
- **当** renderer 收到立即执行响应
- **那么** 应用跳转到本次执行会话页
- **并且** 用户不需要停留在自动化详情页等待整轮 AI 执行完成
- **并且** 该会话页可以继续展示本次执行的消息流

#### Scenario: Refresh sidebar sessions after start

- **前提** 用户点击“立即执行”
- **并且** 主进程返回本次执行创建的会话
- **当** renderer 处理立即执行成功响应
- **那么** 系统刷新该会话所属工作空间的左侧会话列表
- **并且** 新会话出现在左侧会话列表中

#### Scenario: Prevent running unsaved edits accidentally

- **前提** 用户正在自动化详情页编辑配置
- **并且** 当前表单存在未保存修改
- **当** 用户查看右上角操作区
- **那么** “立即执行”按钮不可用
- **并且** 系统不会使用未保存表单内容触发自动化

#### Scenario: Show running feedback

- **前提** 用户点击“立即执行”后启动请求尚未完成
- **当** 立即执行启动请求进行中
- **那么** “立即执行”按钮展示启动中的加载状态
- **并且** 用户不能通过重复点击为同一条自动化发起重复手动执行请求

#### Scenario: Do not wait for AI completion before returning

- **前提** 用户点击“立即执行”
- **并且** 本次执行的会话与 running run 已经创建
- **当** AI 仍在生成回复或执行工具
- **那么** 立即执行 IPC 已经可以返回
- **并且** renderer 可以跳转到本次执行会话
- **并且** 自动化详情页按钮不应持续卡在执行中状态

#### Scenario: Show failure feedback

- **前提** 用户手动立即执行自动化失败
- **当** 执行请求返回错误
- **那么** 系统展示可理解的失败反馈
- **并且** 自动化运行记录保留失败状态和错误信息

### Requirement: Expose Manual Automation Execution API

系统必须提供 renderer 可调用的手动自动化执行 API，并在主进程复用自动化执行服务。

#### Scenario: Call run-now API through preload

- **前提** renderer 需要立即执行某条自动化
- **当** renderer 调用 `runAutomationNow` 并传入自动化 id
- **那么** preload 通过 `RUN_AUTOMATION_NOW` IPC 调用主进程
- **并且** 主进程返回包含最新运行摘要的自动化详情
- **并且** 主进程返回本次执行创建的会话

#### Scenario: Validate automation before manual execution

- **前提** renderer 请求立即执行某条自动化
- **当** 主进程收到请求
- **那么** 主进程校验自动化存在
- **并且** 校验自动化当前允许执行
- **并且** 对不存在、停用或不可执行的自动化返回错误

#### Scenario: Reuse automation execution pipeline

- **前提** 主进程接受一条手动立即执行请求
- **当** 系统执行该自动化
- **那么** 系统复用自动化服务层的工作空间上下文、模型选择、prompt 发送、运行记录和错误记录逻辑
- **并且** 不在 renderer 中直接创建会话或发送 prompt 来绕过自动化服务层

#### Scenario: Return after execution starts

- **前提** 主进程接受一条手动立即执行请求
- **当** 系统已经创建会话、写入 running 运行记录并启动 prompt 发送
- **那么** 主进程返回自动化详情和会话
- **并且** 后台执行继续负责把运行记录更新为 completed 或 failed

#### Scenario: Avoid concurrent runs for same automation

- **前提** 某条自动化已有运行中的任务
- **当** 用户再次请求立即执行同一条自动化
- **那么** 系统不启动第二次并发执行
- **并且** 返回可理解的错误反馈

#### Scenario: Preserve catch-up scheduling anchor

- **前提** 用户手动立即执行某条定时自动化
- **当** 系统记录本次执行
- **那么** 本次手动执行不会错误推进用于 cron 漏跑补偿判断的计划锚点
- **并且** 后续应用启动补偿仍按定时计划语义判断漏跑
