# add-chat-right-sidebar 执行计划

## 当前状态

本计划对应的 change 已完成实现、验收和最终校验，可进入归档。

收口结论：

- `workspace` 主 tab 已补齐工作空间名称与 `soul.md` 编辑保存入口
- `session` 右栏已稳定提供概要与工作空间文件标签
- 顶栏联动折叠、文件树读取与打开工作空间目录能力已完成
- `pnpm lint` 与 `pnpm --filter ./app/work exec tsc --noEmit -p tsconfig.json` 最终通过

## 1. 计划目标

基于已批准的 OpenSpec 变更 `add-chat-right-sidebar`，把当前聊天页从“单主内容区 + 输入区”扩展为“主内容区 + 可折叠右侧栏 + 输入区”的稳定桌面工作台布局。

本次计划严格对应以下 OpenSpec 文档，不替代产品事实：

- `docs/ai-workflows/openspec/changes/add-chat-right-sidebar/proposal.md`
- `docs/ai-workflows/openspec/changes/add-chat-right-sidebar/design.md`
- `docs/ai-workflows/openspec/changes/add-chat-right-sidebar/specs/chat-right-sidebar/spec.md`
- `docs/ai-workflows/openspec/changes/add-chat-right-sidebar/tasks.md`

完成后应满足：

- `Chat.vue` 统一管理右侧栏折叠状态，按钮位于页面右上角
- `workspace` 上下文显示设置型右栏
- `session` 上下文显示“概要 / 文件”双标签右栏
- `TodoProgress` 从输入区上方迁移到 `session` 概要区
- “文件”标签显示当前工作空间文件树
- 参考 UI 虽然来自 React + shadcn 代码稿，但最终实现必须转换为 Vue 3 + `shadcn-vue`
- `workspace` 与 `session` 两类右栏都必须尽量保持参考稿的 UI 结构，而不是只取其大致风格

## 2. 当前实现基线

当前仓库已有以下基础能力，可作为增量改造起点：

- 聊天页路由已经由 `Chat.vue` 作为父壳层承载：
  - `app/work/src/renderer/src/router.ts`
  - 子路由为 `Workspace.vue` 和 `Session.vue`
- 聊天页当前结构与发送逻辑已存在：
  - `app/work/src/renderer/src/pages/chat/Chat.vue`
  - 已集中处理 `sendMessage`、`stopSessionStream`、`resolveToolApproval`
- `session` 页已具备消息滚动与流式状态管理：
  - `app/work/src/renderer/src/pages/chat/session/Session.vue`
  - `app/work/src/renderer/src/composables/useAgentMessages.ts`
- `TODO` 数据链路已存在：
  - `app/work/src/renderer/src/composables/useTodoProgress.ts`
  - `app/work/src/renderer/src/components/base/TodoProgress.vue`
  - 主进程通过 `TODO_UPDATED` 事件同步
- 工作空间基础数据链路已存在：
  - `app/work/src/renderer/src/stores/workspace.ts`
  - `app/work/src/main/service/workspace.service.ts`
  - `app/work/src/main/controllers/workspace/get.workspace.info.controller.ts`
- IPC 暴露模式已固定：
  - `app/work/src/preload/preload.ts`
  - `app/work/src/shared/api.ts`
  - `app/work/src/shared/constants.ts`

当前明确缺失的能力：

- 当前没有右侧栏壳层或折叠状态管理
- 当前没有“工作空间文件树”查询接口
- 当前没有 `session` 概要区组件
- 当前 `workspace` 右栏所需的设置读写链路并不完整

## 3. 已确认的实现边界

这次执行必须遵守以下边界：

- 右栏折叠状态由 `Chat.vue` 统一管理，不在 `Workspace.vue` / `Session.vue` 各自重复实现
- 折叠入口位于聊天页右上角，不能下沉到右栏内部
- 参考稿来自 React + shadcn，实施时必须翻译成 Vue 3 + `shadcn-vue` 组件与模式，不能直接照搬 React 组件写法
- UI 对齐优先级是“先保结构，再接真实数据，再按 `DESIGN.md` 收敛视觉密度与层级”
- `session` 右栏只要求：
  - `概要`
  - `文件`
  - `TODO` 迁移
  - 工作空间文件树浏览
- 本次不实现：
  - 文件预览
  - 文件搜索
  - 文件编辑
  - 上传附件文件管理
- 页面视觉必须收敛到 `DESIGN.md` 的工作台风格，不把右栏做成浮层式抽屉或营销化面板

## 4. 依赖、风险与阻塞项

### 4.1 主要依赖

- renderer 页面与壳层：
  - `app/work/src/renderer/src/pages/chat/Chat.vue`
  - `app/work/src/renderer/src/pages/chat/workspace/Workspace.vue`
  - `app/work/src/renderer/src/pages/chat/session/Session.vue`
  - `app/work/src/renderer/src/components/base/MainTitle.vue`
- renderer store / composable：
  - `app/work/src/renderer/src/stores/workspace.ts`
  - `app/work/src/renderer/src/stores/session.ts`
  - `app/work/src/renderer/src/composables/useAgentMessages.ts`
  - `app/work/src/renderer/src/composables/useTodoProgress.ts`
- 共享类型与 IPC：
  - `app/work/src/shared/api.ts`
  - `app/work/src/shared/constants.ts`
  - `app/work/src/shared/hook/workspace.hook.ts`
  - `app/work/src/preload/preload.ts`
- 主进程 workspace 能力：
  - `app/work/src/main/service/workspace.service.ts`
  - `app/work/src/main/controllers/workspace/*.ts`

### 4.2 主要风险

- 右栏展开 / 折叠可能影响 `session` 页消息区域宽度，进而导致滚动粘底行为异常。
- `TodoProgress` 从输入区迁移后，如果 `useTodoProgress` 的挂载位置变化不当，可能造成切换会话时状态闪烁。
- 文件树 IPC 一旦直接读取过深目录，可能带来性能问题或高噪声目录污染。
- `workspace` 右栏如果没有明确数据存储语义，容易在实现阶段临时发明一套配置持久化方式。

### 4.3 明确阻塞项

以下点在 OpenSpec 中尚未完全决策，不应在 `workflow-implement` 阶段擅自发明行为：

1. `workspace` 右栏中的 `soul.md` 设置到底写入哪里。
当前 OpenSpec 只要求存在 `soul.md` 设置区和保存入口，但未明确以下事实：
   - 是否读写 `<workspace.path>/soul.md`
   - 是否读写应用自己的工作空间配置表
   - 是否当前阶段只展示占位与只读内容

2. 工作空间文件树的过滤规则。
OpenSpec 允许“默认排除明显无意义或高噪声目录时，应在实现阶段明确规则”，但尚未指明是否需要过滤如 `.git`、`node_modules`、隐藏文件。

处理方式：

- `workflow-implement` 开始前，优先确认上述两点。
- 如果无法从现有代码或用户明确指令中得出结论，应回到 `workflow-spec` 补足要求。

## 5. 执行切片

### 切片 A：建立聊天页右栏壳层

目标：

- 让 `Chat.vue` 成为统一的双栏壳层，稳定承载右上角折叠入口、主内容区和右栏容器。

实现步骤：

1. 审查 `Chat.vue`、`Session.vue`、`Workspace.vue` 当前标题与内容边界。
2. 在 `Chat.vue` 中新增右栏展开状态与派生上下文判断：
   - 当前路由是否为 `workspace`
   - 当前路由是否为 `session`
3. 调整模板结构，使 `RouterView` 所在主区与右栏并列。
4. 将折叠 / 展开按钮接入 `MainTitle.vue` 的 `extra` 插槽或等价右上角区域。
5. 为右栏宽度变化添加轻量过渡，确保不破坏底部发送区结构。
6. 移除输入区上方内联 `TodoProgress` 的旧挂载位置，为后续迁移腾空。
7. 以参考稿的整体壳层关系为准进行 Vue 化翻译：
   - `workspace-right-sidebar.tsx` 的“右侧窄边栏 / 展开内容”结构
   - `chat-right-sidebar.tsx` 的“标签页 + 内容滚动区”结构

涉及文件：

- `app/work/src/renderer/src/pages/chat/Chat.vue`
- `app/work/src/renderer/src/components/base/MainTitle.vue`
- 可能新增 `app/work/src/renderer/src/pages/chat/components/*`

验证：

- `workspace` 与 `session` 路由下都能看到统一右上角切换按钮
- 展开 / 折叠时主内容区宽度变化正确
- 输入区功能、发送、停止、审批不受影响

停止条件：

- 页面已具备稳定右栏骨架，但右栏内部仍可先放占位内容

### 切片 B：实现 session 右栏概览面板

目标：

- 把当前会话的辅助信息收敛到 `session` 右栏的“概要”标签内，完成 `TODO` 迁移。

实现步骤：

1. 按 [`docs/ui-design/chat-right-sidebar.tsx`](/Users/liujinglun/code/willow/docs/ui-design/chat-right-sidebar.tsx) 的 UI 结构创建 Vue 3 + `shadcn-vue` 版本右栏组件，至少保留：
   - 标签页骨架
   - 概要内容区
   - 文件内容区
   - 可滚动内容容器
2. 为概要区建立会话派生信息读取逻辑：
   - 会话标题
   - 创建时间 / 最近活跃时间中的可用值
   - 消息数量
3. 将 `useTodoProgress(sessionId)` 的使用位置迁移到 `session` 右栏。
4. 在概要区复用 `TodoProgress.vue`，并处理“无 TODO”时的受控隐藏。
5. 确保旧输入区上方不再渲染 `TodoProgress`。
6. 将参考稿中的 React 组件语义翻译为 `shadcn-vue` 对应组件：
   - `Tabs`
   - `ScrollArea`
   - `Collapsible`
   - `Button`

涉及文件：

- `app/work/src/renderer/src/pages/chat/Chat.vue`
- `app/work/src/renderer/src/pages/chat/session/Session.vue`
- 新增 `app/work/src/renderer/src/pages/chat/session/components/*`
- `app/work/src/renderer/src/composables/useTodoProgress.ts`
- `app/work/src/renderer/src/stores/session.ts`

验证：

- 进入任意会话时，右栏可见“概要 / 文件”标签
- 有 TODO 的会话能在概要区看到进度
- 无 TODO 的会话不会出现空壳进度块
- 切换会话时 `TODO` 与会话标题同步更新
- 标签、滚动区、概要分组和文件页签结构与参考稿保持一致的层次关系

停止条件：

- 概要区成为 `session` 右栏的默认信息入口，旧 TODO 浮块已移除

### 切片 C：补齐工作空间文件树数据链路

目标：

- 提供当前工作空间文件树的真实数据接口，供 `session` 右栏“文件”标签使用。

实现步骤：

1. 在共享层增加文件树相关类型与请求 / 响应定义。
2. 在 `shared/constants.ts` 增加新的 IPC 常量。
3. 在 `shared/hook/workspace.hook.ts` 和 `preload/preload.ts` 暴露新的文件树读取方法。
4. 在主进程新增 controller 与 `WorkspaceService` 读取能力：
   - 以当前工作空间根路径为起点
   - 返回树状结构
   - 明确空目录、路径不存在、不可读时的返回或报错语义
5. 若需要过滤高噪声目录，先基于已确认规则实现；若规则未确认，则在计划执行前补规格。

涉及文件：

- `app/work/src/shared/api.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/shared/hook/workspace.hook.ts`
- `app/work/src/preload/preload.ts`
- `app/work/src/main/service/workspace.service.ts`
- 新增 `app/work/src/main/controllers/workspace/get.workspace.files.controller.ts`
- `app/work/src/main/app.module.ts`

验证：

- 给定有效工作空间时，可返回稳定文件树数据
- 空目录能返回空态而非异常
- 不存在 / 不可读目录时，renderer 能拿到受控错误

停止条件：

- renderer 已能以 IPC 方式获取当前工作空间文件树

### 切片 D：实现 session 右栏文件树展示

目标：

- 在 `session` 右栏的“文件”标签中展示当前工作空间文件树，并处理展开 / 收起与空态。

实现步骤：

1. 在 renderer 侧创建文件树展示组件，并按 [`docs/ui-design/chat-right-sidebar.tsx`](/Users/liujinglun/code/willow/docs/ui-design/chat-right-sidebar.tsx) 的结构翻译为 Vue 3 + `shadcn-vue`：
   - 文件夹展开 / 收起
   - 基础文件图标映射
   - 递归树渲染
2. 在 `session` 右栏面板中接入工作空间文件树数据请求。
3. 会话页根据 `sessionId` 找到关联 `workspaceId`，并读取对应文件树。
4. 增加受控状态：
   - 加载中
   - 空目录
   - 路径无效 / 不可读
5. 保持本次范围只做浏览，不挂接点击预览或编辑。

涉及文件：

- `app/work/src/renderer/src/pages/chat/session/Session.vue`
- 新增 `app/work/src/renderer/src/pages/chat/session/components/session-file-tree*.vue`
- `app/work/src/renderer/src/stores/workspace.ts`
- 可能新增 `app/work/src/renderer/src/composables/useWorkspaceFiles.ts`

验证：

- 切到“文件”标签时能看到当前工作空间文件树
- 文件夹可展开 / 收起
- 空目录和错误态文案正确
- 文件树按钮、缩进、目录折叠关系与参考稿结构一致

停止条件：

- “文件”标签已基于真实工作空间数据渲染，而非静态 mock

### 切片 E：实现 workspace 右栏设置面板

目标：

- 在 `workspace` 上下文下渲染设置型右栏，并接上已确认的数据来源。

实现步骤：

1. 按 [`docs/ui-design/workspace-right-sidebar.tsx`](/Users/liujinglun/code/willow/docs/ui-design/workspace-right-sidebar.tsx) 的 UI 结构建立 Vue 3 + `shadcn-vue` 版本右栏面板，至少保留：
   - 顶部折叠态对应的窄栏表达
   - 工作空间地址分组
   - `soul.md` 设置分组
   - 底部保存动作
2. 接入已有工作空间基础信息：
   - 名称
   - 路径
3. 为路径相关展示 / 编辑明确采用的交互：
   - 只读展示
   - 或通过已有目录选择能力修改
4. 为 `soul.md` 区域接入已确认的读写行为。
5. 增加保存动作与受控反馈。

涉及文件：

- `app/work/src/renderer/src/pages/chat/workspace/Workspace.vue`
- 新增 `app/work/src/renderer/src/pages/chat/workspace/components/*`
- `app/work/src/renderer/src/stores/workspace.ts`
- 如果需要新增读写链路，则同步修改：
  - `app/work/src/shared/api.ts`
  - `app/work/src/shared/hook/workspace.hook.ts`
  - `app/work/src/preload/preload.ts`
  - `app/work/src/main/controllers/workspace/*.ts`
  - `app/work/src/main/service/workspace.service.ts`

验证：

- `workspace` 路由下右栏展示为设置分组，而不是空白页
- 工作空间基础信息展示正确
- 保存入口存在且反馈受控
- 分组顺序、字段结构和折叠态信息组织与参考稿一致

停止条件：

- `workspace` 右栏结构可用，且不依赖临时假数据

### 切片 F：统一状态处理与视觉校准

目标：

- 在不偏离 `DESIGN.md` 的前提下，补齐右栏相关的加载、空态、错误态与视觉层级。

实现步骤：

1. 统一右栏各面板的容器表面、边框、内边距和标题层级。
2. 校准标签页、文件树、设置字段、概要分组的密度。
3. 补齐以下状态：
   - `workspace` 信息未加载
   - 当前会话不存在
   - 当前会话无 TODO
   - 工作空间文件读取失败
   - 工作空间目录为空
4. 检查折叠 / 展开动画是否克制且无跳闪。

涉及文件：

- `app/work/src/renderer/src/pages/chat/Chat.vue`
- 新增或修改的右栏组件文件
- 可能涉及 `app/work/src/renderer/index.css` 或局部样式类

验证：

- 所有受控状态都有明确文案
- 主聊天区仍是第一视觉主体
- 右栏不出现过重阴影、过大留白或浮层化表达

停止条件：

- 右栏体验在功能与视觉上都达到可交付状态

## 6. 推荐执行顺序

建议按以下顺序进入 `workflow-implement`：

1. 切片 A：先把壳层和按钮位置稳定下来
2. 切片 B：先完成 `session` 概要和 TODO 迁移，尽快消除旧浮块
3. 切片 C：先补文件树数据链路
4. 切片 D：再把文件树接到 `session` 右栏
5. 切片 E：最后做 `workspace` 设置面板，因为它依赖 `soul.md` 存储语义确认
6. 切片 F：统一做状态和视觉收口

原因：

- A/B 可以最快建立页面主骨架和最明显的用户可见变化
- C/D 是一条完整的主进程到 renderer 数据链路，最好连续完成
- E 的需求歧义最大，放后面能减少返工

## 7. 验证清单

实现阶段至少完成以下验证：

1. 路由验证
   - `/?workspaceId=...` 下显示 workspace 右栏
   - `/:sessionId` 下显示 session 右栏
2. 折叠验证
   - 右上角按钮位置稳定
   - 展开 / 折叠不影响消息发送与停止
3. TODO 迁移验证
   - 输入区上方旧进度块消失
   - 概要区展示与事件更新同步
4. 文件树验证
   - 正常目录可浏览
   - 空目录有空态
   - 无效路径 / 不可读路径有错误态
5. 视觉验证
   - 对照 `DESIGN.md`
   - 主内容区层级高于右栏
   - 右栏密度紧凑、边框克制、无营销化装饰
6. 结构对照验证
   - `workspace` 右栏对照 `docs/ui-design/workspace-right-sidebar.tsx`
   - `session` 右栏对照 `docs/ui-design/chat-right-sidebar.tsx`
   - React + shadcn 参考结构已被正确翻译成 Vue 3 + `shadcn-vue`，没有退化成仅样式相似的另一套布局

建议命令：

- `pnpm lint`
- 如涉及类型或构建异常，再补充运行 `pnpm build`

## 8. 实施前假设

进入 `workflow-implement` 前默认采用以下假设；若任一假设不成立，应先回到 `workflow-spec`：

- `session` 文件标签展示的是当前会话所属工作空间根目录文件树
- `session` 概要区的消息数量可由当前消息历史直接派生
- 右栏展开状态在路由切换间保持稳定，不因 `workspace` / `session` 切换自动重置
- `workspace` 右栏中的 `soul.md` 存储语义会在实现前被补充明确

## 9. 下一步

进入 `workflow-implement`，按本计划的切片顺序实施；如遇到 `soul.md` 存储语义或文件树过滤规则无法确认，先回到 `workflow-spec` 补足要求，再继续编码。
