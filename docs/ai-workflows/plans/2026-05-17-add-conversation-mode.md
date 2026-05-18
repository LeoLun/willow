# 新增独立无限对话模式 — 执行计划

## 目标

按 `add-conversation-mode` OpenSpec 落地一个系统级“对话”作用域：

- 默认根目录为用户主目录下的 `.willow`
- 左侧栏新增“对话”一级入口，位于“工作空间”上方
- 对话入口表现为单条无限会话流，不展示历史树
- 对话作用域使用独立上下文压缩策略
- 悬浮球动画只响应对话作用域的流式输出

本计划只描述执行顺序、改动落点、验证方式和停手条件，不重定义需求。

## 实施前提

### 已确认前提

- 已有普通会话压缩能力，核心入口在 `app/work/src/main/service/context-compression.service.ts`
- 当前会话数据仍以 `workspaces` / `sessions` / `session_messages` 为主骨架
- 当前路由与左侧栏仍以“工作空间 → 会话”模型为中心
- 悬浮球当前通过 `UPDATE_MESSAGE` 的 `agent_start/agent_end` 事件驱动动画

### 本计划采用的实现决策

- 采用 OpenSpec 推荐方案 A：系统级对话工作区 + 单条无限会话
- 优先复用现有 `workspace/session` 数据结构，不在本次新建独立 `conversation_messages` 消息主表
- “对话”与“工作空间”通过显式作用域字段区分，而不是依赖名称约定或路径推断

### 需要在实现第 1 阶段先落地的技术决策

以下决策是实现依赖项，必须先定型后再推进后续阶段：

1. 工作区作用域字段使用 `workspaces.kind`，取值至少包含 `project | conversation`
2. 系统级对话工作区只允许一条记录
3. 对话无限流只允许一条“当前会话”；本次不做历史切换 UI
4. 对话压缩状态使用独立表，而不是继续挤进 `session_context_summaries`

若第 1 阶段实现中发现以上任一项与现有迁移、DAO 或事件模型发生结构性冲突，应暂停并回到 `workflow-spec` 收敛。

## 执行切片

```
阶段 1：作用域骨架与默认目录
  └── 打通“conversation workspace + 当前会话”主进程通路

阶段 2：路由、页面与侧边栏入口
  └── 打通 renderer 入口与默认跳转

阶段 3：对话发送链路与作用域透传
  └── 让消息发送、历史恢复、事件广播识别 conversation

阶段 4：独立上下文压缩
  └── 接入对话专属压缩状态与分层摘要

阶段 5：悬浮球事件门控
  └── 只响应对话作用域流式事件

阶段 6：回归验证与收尾
```

每个阶段都要求能独立编译，并具备最小可验证结果后再进入下一阶段。

## 阶段 1：作用域骨架与默认目录

### 目标

在主进程建立“系统级对话工作区”的建模、创建与查询能力，为后续 UI 和发送链路提供稳定入口。

### 涉及文件 / 子系统

- `app/work/src/main/db/schema.ts`
- `app/work/src/main/db/migrations/*`
- `app/work/src/shared/api.ts`
- `app/work/src/main/service/dao/workspace.dao.service.ts`
- `app/work/src/main/service/workspace.service.ts`
- `app/work/src/main/service/session.service.ts`
- 相关 controller / preload 暴露层（若需要新增“获取对话入口” API）

### 实施步骤

#### 1.1 为工作区增加作用域字段

- 在 `workspaces` 表新增 `kind` 字段，默认值为 `project`
- 为已有数据提供向后兼容迁移，确保旧工作区自动归类为 `project`
- 在共享类型 `Workspace` 中增加 `kind`

停手条件：

- 本地 schema、迁移和 DAO 能稳定返回 `kind`
- 现有工作区列表读取不报错

#### 1.2 定义系统级对话工作区获取逻辑

- 在 `WorkspaceService` 新增 `getOrCreateConversationWorkspace()` 或等价方法
- 对话工作区路径固定为 `path.join(app.getPath("home"), ".willow")`
- 若目录不存在则创建；若数据库中不存在对话工作区则创建记录
- 增加“只允许一条 conversation workspace”的保护逻辑

停手条件：

- 重复调用获取方法时返回同一条工作区记录
- 主目录下 `.willow` 可自动创建且不会影响普通项目工作区

#### 1.3 定义“获取或创建当前无限会话”逻辑

- 在 `SessionService` 中新增 `getOrCreateConversationSession()`
- 查询 conversation workspace 下最近活跃或唯一会话
- 无会话时自动创建一条空会话
- 删除普通项目工作区时不得波及该作用域

停手条件：

- 对话作用域可以稳定返回同一条当前会话
- 普通工作区删除路径不误删 conversation workspace / session

### 验证

- 数据迁移后已有项目工作区继续可见
- 首次调用 conversation 入口时自动创建 `~/.willow`
- 多次进入 conversation 入口不会重复创建工作区或会话

## 阶段 2：路由、页面与侧边栏入口

### 目标

把“对话”做成可见、可点击、可进入的一级入口，并避免干扰现有项目工作空间导航。

### 涉及文件 / 子系统

- `app/work/src/renderer/src/router.ts`
- `app/work/src/renderer/src/layout/sidebar/NavMain.vue`
- `app/work/src/renderer/src/pages/chat/Chat.vue`
- `app/work/src/renderer/src/pages/chat/workspace/Workspace.vue`
- 新增 `app/work/src/renderer/src/pages/chat/conversation/Conversation.vue` 或等价页面
- `workspace` / `session` store（若需要补充 conversation 获取能力）

### 实施步骤

#### 2.1 新增 conversation 专用路由

- 在 `router.ts` 中新增 `/conversation`
- 调整默认入口策略：无 `workspaceId` 时优先落到 `/conversation`，或在无项目时至少能稳定进入 `/conversation`
- 保留现有 `/:sessionId` 和 `/workspace/:workspaceId/history`

停手条件：

- 新路由可以独立打开，不依赖 query 里的 `workspaceId`
- 原有项目路由不回退

#### 2.2 新增对话页面容器

- 对话页面负责加载 conversation workspace 与当前无限会话
- 尽量复用现有聊天内容区和输入区，不在本阶段重写消息 UI
- 对话页面文案与结构遵循 `DESIGN.md` 的桌面工作台风格

停手条件：

- 进入 `/conversation` 后可看到会话内容或空会话态
- 页面不要求用户先选项目

#### 2.3 调整左侧栏导航

- 在 `NavMain.vue` 中于“工作空间”分组前新增“对话”分区
- 使用单入口，不显示折叠箭头、历史树、“查看更多”
- 保留工作空间树、会话列表、重命名/删除等原行为

停手条件：

- “对话”稳定显示在“工作空间”上方
- 点击进入 `/conversation`
- 工作空间树功能不受影响

### 验证

- 打开应用后可从左侧栏进入“对话”
- 项目工作空间仍能展开、切换和查看历史
- `/conversation` 与项目页互相切换不出现路由死循环

## 阶段 3：对话发送链路与作用域透传

### 目标

让 conversation 作用域能够真正发送消息、恢复历史，并在主进程事件中携带明确作用域信息。

### 涉及文件 / 子系统

- `app/work/src/shared/api.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/main/controllers/session/*`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- renderer 侧 message/store/composable

### 实施步骤

#### 3.1 明确 conversation 入口如何拿到 sessionId

- 方案优先级：
  1. `/conversation` 页面初始化时向主进程请求当前 conversation session，再把其作为内部当前会话使用
  2. 避免把 conversation sessionId 暴露成用户需要管理的显式历史树
- 若现有消息页面强依赖 `route.params.sessionId`，则在本阶段做轻量兼容桥接，而不是全量重构

停手条件：

- 对话页发送第一条消息时能命中正确 session
- 刷新后仍能恢复同一条 conversation 流

#### 3.2 发送链路透传作用域

- 在主进程层拿到 session 时，同时解析其 workspace.kind
- 在 `SessionService.sendMessage()` 广播 `UPDATE_MESSAGE` 时附带 `chatScope` 或等价字段
- 必要时把该字段也透传到 `CONTEXT_COMPRESSION_UPDATED` 等用户可见事件

停手条件：

- renderer 和悬浮球都可以仅靠事件负载判定本次流式是否来自 conversation

#### 3.3 校正标题生成、历史入口和会话操作

- conversation 作用域不在侧边栏展示标题树，因此即使内部仍保留标题字段，也不作为主要 UI
- 若现有删除/重命名会话能力默认暴露给所有 session，需对 conversation 作用域做隐藏或禁用
- WorkspaceHistory 页不得把 conversation 会话作为普通工作空间历史暴露出来

停手条件：

- 对话入口不存在会话树操作残留
- 项目工作空间历史页不混入 conversation 记录

### 验证

- `/conversation` 内发送、停止、继续发送均可用
- 刷新或重新进入页面后历史仍保留
- 事件负载中可识别 `conversation | workspace`

## 阶段 4：独立上下文压缩

### 目标

在不破坏现有项目会话压缩的前提下，为 conversation 作用域提供分层滚动压缩。

### 涉及文件 / 子系统

- `app/work/src/main/service/context-compression.service.ts`
- 新增 `conversation-context-compression.service.ts` 或等价模块
- `app/work/src/main/service/dao/session-context-summary.dao.service.ts`
- 新增 conversation 压缩状态 DAO / schema / migration
- `app/work/src/main/service/agent.service.ts`
- `packages/core/src/system-prompt.ts` 与相关 context prompt 辅助模块（如需要）

### 实施步骤

#### 4.1 建立 conversation 专属压缩持久化结构

- 新增用于 conversation 的压缩状态表，至少覆盖：
  - `session_id`
  - `checkpoint_index`
  - `summary`
  - `stable_facts`
  - `open_loops`
  - `compressed_until_message_id`
  - `estimated_tokens`
- DAO 提供按 session 查询、upsert、清理能力

停手条件：

- 可以独立读写 conversation 压缩状态
- 不影响现有 `session_context_summaries`

#### 4.2 拆分压缩策略入口

- `AgentService.getDefaultAgent()` 在拿到 session 后，按作用域选择：
  - `workspace` → 现有 `ContextCompressionService`
  - `conversation` → 新的 conversation 压缩服务
- 两条路径共享基础 token 估算工具，但摘要结构与注入内容不同

停手条件：

- 项目会话行为与当前一致
- conversation 会话能进入独立 prepare 分支

#### 4.3 实现 conversation 分层摘要

- 最少实现四层中的三层可用结果：
  - 长期事实层
  - 未闭环事项层
  - 热窗口层
- 滚动摘要层可作为检查点摘要持久化
- 初版允许采用“单次生成结构化 Markdown + 状态拆段存储”的方式，避免一次性做复杂多表拼装

停手条件：

- conversation 触发压缩后，系统上下文中可以稳定注入长期事实 / 未闭环事项 / 检查点摘要

#### 4.4 处理摘要再整理

- 当滚动摘要再次接近阈值时，对最早检查点摘要做高层合并
- 保障热窗口优先，不把同一轮对话截断
- 若 conversation 专属压缩失败，定义与普通会话不同的降级提示文案，但仍保持可发送

停手条件：

- 多次压缩后不会出现摘要无限膨胀导致再次不可发

### 验证

- 普通项目会话继续使用当前压缩提示与行为
- conversation 长对话触发压缩后仍能记住长期偏好、开放事项和最近上下文
- 多次压缩后仍能继续发送

## 阶段 5：悬浮球事件门控

### 目标

让悬浮球动画只响应 conversation 作用域的流式开始/结束事件。

### 涉及文件 / 子系统

- `app/work/src/renderer-floating-ball/FloatingBall.vue`
- `app/work/src/shared/api.ts` / `constants.ts`（若事件类型变更）
- `app/work/src/main/service/session.service.ts`
- 任何定义事件负载类型的共享模块

### 实施步骤

#### 5.1 扩充浮层消费事件字段

- 为 `UPDATE_MESSAGE` 事件负载补充 conversation 判定字段
- 若已有共享事件类型定义，先补类型，再补发送端

停手条件：

- 浮层组件可以直接从事件负载判断本次消息是否属于 conversation

#### 5.2 修改悬浮球监听逻辑

- `FloatingBall.vue` 中仅在 `chatScope === "conversation"` 时响应 `agent_start` / `agent_end`
- 若收到项目工作空间事件则忽略
- 若应用存在并发流式场景，需避免被非 conversation 的 `agent_end` 错误复位

停手条件：

- 对话模式消息流式中显示动画
- 项目会话消息流式中不显示动画

### 验证

- 对话页发送消息 → 悬浮球动画开始，结束后恢复
- 项目工作空间页发送消息 → 悬浮球无动画
- 切换页面或快速多次发送时状态不抖动

## 阶段 6：回归验证与收尾

### 自动检查

- `pnpm lint`
- `pnpm build`

### 手动验证清单

1. 首次进入“对话”时自动创建 `~/.willow`
2. 左侧栏显示“对话”分区，位置在“工作空间”上方
3. “对话”不展示历史树、查看更多或会话级菜单
4. 对话页可连续多轮发送并刷新恢复
5. 项目工作空间聊天仍正常
6. conversation 长对话能触发独立压缩
7. 项目工作空间长对话仍使用原有压缩逻辑
8. 悬浮球只对 conversation 流式输出显示动画

### 收尾条件

- OpenSpec `tasks.md` 中每一项都能映射到已完成实现或已验证结果
- 无新的产品行为缺口需要退回 `workflow-spec`
- 可以进入 `workflow-implement`

## 风险与阻塞点

### 风险 1：现有页面强绑定 `workspaceId` / `sessionId`

表现：

- `router.ts`、`Workspace.vue`、侧边栏和会话页目前默认围绕工作空间 query 参数工作

应对：

- 先通过 `/conversation` 页面内部请求当前 session 的方式打通，不先做全局路由抽象

### 风险 2：压缩逻辑耦合普通会话结构

表现：

- 当前 `ContextCompressionService` 直接围绕 `session_context_summaries` 和“最近消息窗口”工作

应对：

- 保持原服务不动，新建 conversation 专属服务与持久化表，避免在同一类中堆太多分支

### 风险 3：事件字段扩展导致多端消费不一致

表现：

- renderer 主聊天页和悬浮球都依赖 `UPDATE_MESSAGE`

应对：

- 先补共享类型，再统一调整发送端和两个消费端，避免只改一侧

## 实施顺序建议

建议按以下顺序提交：

1. 数据库与主进程作用域骨架
2. conversation 入口路由与左侧栏
3. conversation 当前会话加载与发送打通
4. 作用域字段透传到事件
5. conversation 专属压缩
6. 悬浮球门控
7. lint / build / 手测收尾

## 下一步

进入 `workflow-implement`，按本计划逐阶段实现 `add-conversation-mode`。
