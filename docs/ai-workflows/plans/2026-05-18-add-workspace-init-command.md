# add-workspace-init-command 执行计划

## 目标

按 `add-workspace-init-command` OpenSpec 落地完整的“工作空间 Agent”能力，并修正当前偏差：

- 在项目工作空间内提供内置 `/init`，通过真实 LLM 创建或改进根目录 `AGENTS.md`
- 从工作空间 `AGENTS.md` 解析 `名称` 与 `描述`，注册为对话可发现的工作空间 Agent
- 让对话页作为主 Agent，通过独立 tool 调用工作空间子 Agent
- 每次工作空间委派都创建独立子 Agent 会话，支持点击 tool 卡片跳转
- 子 Agent 只向主 Agent 回调最终结果层信息，不把中间工具调用和过程细节回填到主会话

本计划是实现视图，不重新定义产品行为；所有产品约束以对应 OpenSpec 为准。

## 当前基线与纠偏点

### 已有基础

- 工作空间设置页已经可以直接读写根目录 `AGENTS.md`
- sender 已有 slash 资源选择器和结构化资源发送链路
- 主进程已有工作空间 Agent 摘要读取、`/init` 基础入口和工作空间资源类型扩展的第一版实现
- 对话页已能展示工作空间 Agent，并支持显式选择

### 必须纠正的实现偏差

- `/init` 不能继续使用本地模板直写，必须走一次真实的 LLM 生成或重写
- 工作空间委派不能继续通过“切换主 Agent 的目标工作空间上下文”来模拟
- 主会话不能接收子 Agent 的中间工具调用和过程消息
- 对话中的工作空间委派必须有独立 tool UI，而不是仅靠普通 assistant 文本

若实现中发现以上任一点无法在现有会话模型内成立，应暂停并回到 `workflow-spec`。

## 执行切片

```text
阶段 1：盘点现有实现并冻结可复用边界
阶段 2：修正 /init 为真实 LLM 调用链路
阶段 3：统一 slash 资源与 /init 的 skill 式 UI 表现
阶段 4：建立独立子 Agent 会话编排模型
阶段 5：把工作空间委派建模为独立 tool 与跳转卡片
阶段 6：接入主 Agent 自动委派与显式指定优先
阶段 7：回归验证与收尾
```

每一阶段都要求先有最小可验证结果，再进入下一阶段。

## 阶段 1：盘点现有实现并冻结可复用边界

### 目标

确认现有代码中哪些部分可以保留，哪些必须重做，避免在旧实现上继续叠加。

### 重点检查子系统

- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/workspace-agent.service.ts`
- `app/work/src/main/service/workspace-init.service.ts`
- `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue`
- `packages/sender/src/components/Sender.vue`
- 与 tool 渲染、会话路由、消息持久化相关的主进程 / renderer 模块

### 实施步骤

#### 1.1 标记可复用部分

- 保留工作空间 Agent 摘要解析、IPC 常量与 slash 资源基础类型
- 保留对话页工作空间 Agent 列表加载与显式选择能力
- 保留 `/init` 的作用域判断、工作空间扫描和文件写回基础能力

停手条件：

- 已形成一份“可保留 / 必须重做”的实现清单

#### 1.2 标记必须替换部分

- 找出 `/init` 中模板直写或非 LLM 生成路径
- 找出“主 Agent 切换 cwd 执行”的委派路径
- 找出当前是否把子 Agent 结果直接并入主会话消息流
- 找出当前 tool UI 是否只是普通消息包装

停手条件：

- 已明确需要改造的入口函数、消息结构和会话模型落点

### 验证

- 实现计划中的后续阶段都能映射到明确文件或服务
- 不再把“复用现有 Agent 运行时并切 cwd”当作可接受终态

## 阶段 2：修正 `/init` 为真实 LLM 调用链路

### 目标

让 `/init` 在项目工作空间中通过真实 LLM 生成或重写 `AGENTS.md`，同时保留已有扫描与写回框架。

### 涉及文件 / 子系统

- `app/work/src/main/service/workspace-init.service.ts`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- `app/work/src/main/controllers/session/*`

### 实施步骤

#### 2.1 梳理 `/init` 输入构造

- 汇总工作空间名称、主要目录、工作空间技能和关键文件索引
- 读取已有 `AGENTS.md` 作为改进输入
- 固化提示词结构，确保保留 OpenSpec 定义的章节与触发语义要求

停手条件：

- `/init` 生成输入覆盖名称、描述、技能索引、文件索引和触发说明要求

#### 2.2 接入真实 LLM 生成

- 让 `/init` 进入标准 Agent / LLM 调用链路，而不是服务内本地拼接
- 区分“新建”与“改进”两种提示上下文
- 为空输出、格式缺失、超长结果添加守护逻辑

停手条件：

- 最终写回文本直接来自一次 LLM 结果
- 不存在 template-only 输出分支

#### 2.3 写回与最小校验

- 写回前校验结果是否包含 `名称`、`描述`、工作空间作用、技能索引、必须文件索引
- 对明显不合格结果执行一次受控重试或失败返回
- 写回后让工作空间 Agent 摘要解析能重新读出可用 `名称` / `描述`

停手条件：

- 新建与改进两条路径都能稳定生成可被解析的 `AGENTS.md`

### 验证

- 工作空间无 `AGENTS.md` 时可生成新文件
- 已有 `AGENTS.md` 时会改进而不是粗暴覆盖
- 主进程中能证明 `/init` 真实经过 LLM 调用路径

## 阶段 3：统一 slash 资源与 `/init` 的 skill 式 UI 表现

### 目标

让 `/init` 虽然是内置命令，但在选择态、发送态和结果态上尽量复用 skill invocation 的 UI 感知。

### 涉及文件 / 子系统

- `packages/sender/src/components/Sender.vue`
- `packages/sender/src/components/ResourcePickerPanel.vue`
- `packages/sender/src/types.ts`
- `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue`

### 实施步骤

#### 3.1 统一资源选择表现

- `/init` 继续使用独立资源类型，但在输入区标签样式上与 skill 保持同层级
- 保持发送前可见、可移除、可随草稿共存

停手条件：

- 用户在输入区感知不到 `/init` 是一套完全不同的选择机制

#### 3.2 统一执行反馈路径

- 发送后进入与 skill 调用一致层级的执行中反馈
- 结果通过正常消息流返回，不使用旁路 toast 或静默成功

停手条件：

- `/init` 从选择到完成的体验与 skill invocation 路径一致

### 验证

- 工作空间中 slash 能看到 `/init`
- `/init` 选择态、发送态、完成态与 skill 调用保持一致层级

## 阶段 4：建立独立子 Agent 会话编排模型

### 目标

把“对话委派工作空间”从上下文切换改为真实独立子 Agent 会话。

### 涉及文件 / 子系统

- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- 会话持久化或运行状态相关服务
- 可能新增 `workspace-agent-orchestrator.service.ts` 或等价服务

### 实施步骤

#### 4.1 定义子会话创建协议

- 明确主 Agent 发起委派时需要的输入：
  - 目标工作空间 ID
  - 目标 Agent 名称
  - 主 Agent 转述任务
- 定义子会话结果结构：
  - `childSessionId`
  - `childWorkspaceId`
  - `childWorkspaceName`
  - `childAgentName`
  - `status`
  - `finalSummary`
  - `failureReason`

停手条件：

- 主子会话之间有稳定、可持久化的输入输出协议

#### 4.2 创建真正独立的子 Agent 运行实例

- 为每次委派创建独立会话或等价运行实体
- 子 Agent 在目标工作空间 `cwd`、该工作空间 `AGENTS.md` 和技能集下构建上下文
- 子 Agent 不复用主 Agent 的消息历史

停手条件：

- 不再通过修改主 Agent `cwd` 或 prompt 模拟委派

#### 4.3 定义结果回传边界

- 子 Agent 完成后只向主 Agent 回传最终结果层信息
- 中间工具调用、审批过程和过程日志只留在子会话
- 停止、失败、审批归属都能跨编排边界传递状态

停手条件：

- 主会话拿不到子 Agent 的中间事件流
- 子会话自身仍保留完整执行历史

### 验证

- 每次委派都有独立 `childSessionId`
- 主会话停止后，子 Agent 能同步中断
- 主会话收到的是最终结果，不是中间工具调用流

## 阶段 5：把工作空间委派建模为独立 tool 与跳转卡片

### 目标

在主会话中把工作空间委派呈现为独立 tool 调用记录，并支持点击进入子会话。

### 涉及文件 / 子系统

- tool 消息结构与渲染组件
- `app/work/src/renderer/src/pages/chat/components/*`
- `packages/sender` 或现有 tool renderer 相关模块
- 会话路由与页面跳转相关模块

### 实施步骤

#### 5.1 定义委派 tool 消息结构

- 为工作空间委派增加专用 tool 名称和结果结构
- 结果至少包含：
  - 目标工作空间名称
  - 目标 Agent 名称
  - 状态
  - 最终摘要或失败原因
  - 子会话导航信息

停手条件：

- 主会话中存在独立于 assistant 文本的委派 tool 记录

#### 5.2 实现独立 renderer

- 运行中显示明确的“调用工作空间子 Agent”状态
- 完成后显示最终结果摘要
- 不展开子 Agent 内部工具调用列表

停手条件：

- 用户一眼能分辨这是一次工具化委派，而不是普通回复

#### 5.3 接入子会话跳转

- 卡片提供“查看子会话”或等价 CTA
- 点击后导航到目标工作空间中的对应子 Agent 会话
- 返回主会话后，原对话仍保留

停手条件：

- 可以稳定从主会话跳到指定 `childSessionId`

### 验证

- 主会话中出现独立委派 tool 卡片
- 卡片只显示最终结果层信息
- 点击卡片后能进入子 Agent 会话并查看完整历史

## 阶段 6：接入主 Agent 自动委派与显式指定优先

### 目标

在独立子会话编排已可用的前提下，接入对话页的显式指定和自动委派判断。

### 涉及文件 / 子系统

- `app/work/src/main/service/session.service.ts`
- `packages/core/src/system-prompt.ts`
- 工作空间 Agent 摘要服务
- 发送 payload 与 slash 资源协议

### 实施步骤

#### 6.1 保留显式指定优先

- 若本轮 payload 带有工作空间 Agent 目标，直接创建对应子会话
- 不再为该轮重新自动选择其他工作空间

停手条件：

- 显式指定路径稳定、可预测

#### 6.2 注入最小工作空间 Agent 索引

- 仅在对话作用域向主 Agent 注入精简索引：
  - `workspaceName`
  - `agentName`
  - `agentDescription`
- 不把整份 `AGENTS.md` 全量注入每轮对话

停手条件：

- 主 Agent 有足够信息做路由判断，且上下文预算可控

#### 6.3 实现自动委派判断

- 没有显式目标时，由主 Agent 判断是否调用工作空间委派 tool
- 匹配明显时创建子会话
- 不明显时保持主 Agent 自己处理

停手条件：

- 自动委派不是每轮必派
- 无匹配请求不会产生空转子会话

### 验证

- 显式指定优先于自动路由
- 明显匹配请求可走委派 tool
- 不匹配请求仍由主 Agent 直接处理

## 阶段 7：回归验证与收尾

### 目标

完成端到端回归，确认 `/init`、工作空间 Agent 发现、独立子会话编排、委派 tool UI 和跳转协同正常。

### 实施步骤

#### 7.1 主流程手动验证

- 在项目工作空间中执行 `/init`
- 确认生成或改进后的 `AGENTS.md` 能被再次解析为工作空间 Agent 摘要
- 切换到对话作用域，确认 slash 可见工作空间 Agent
- 显式指定某个工作空间 Agent，确认出现委派 tool 卡片
- 点击卡片进入子会话，确认可查看完整过程
- 返回主会话，确认只看到最终结果层摘要
- 不显式指定时，分别验证自动委派和不委派两条路径

#### 7.2 自动检查

- 运行 `pnpm lint`
- 运行 `pnpm build`
- 如子系统影响较集中，补充受影响包的定向验证

#### 7.3 结果记录

- 记录哪些旧实现被替换，哪些沿用
- 若自动委派效果仍依赖提示词微调，但协议与边界正确，可记录为后续优化项
- 若必须改变 OpenSpec 才能继续，应停止并回到 `workflow-spec`

### 完成条件

- `/init` 已走真实 LLM 生成链路
- 工作空间委派已创建独立子 Agent 会话
- 主会话中存在独立委派 tool UI
- 点击 tool 卡片可跳转到对应子会话
- 主会话默认不展示子 Agent 中间工具细节
- `pnpm lint`、`pnpm build` 通过，或明确记录非本次变更导致的阻塞

## 高概率改动清单

- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- `app/work/src/main/service/workspace-agent.service.ts`
- `app/work/src/main/service/workspace-init.service.ts`
- `app/work/src/shared/api.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/preload/preload.ts`
- `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue`
- `packages/sender/src/types.ts`
- `packages/sender/src/components/Sender.vue`
- `packages/sender/src/components/ResourcePickerPanel.vue`
- tool 渲染与会话路由相关 renderer 模块

可能新增：

- `app/work/src/main/service/workspace-agent-orchestrator.service.ts`
- `app/work/src/main/service/workspace-agent-routing.service.ts`
- 子会话导航 / 持久化辅助模块
- 工作空间委派 tool renderer 组件

## 依赖与假设

- `AGENTS.md` 的中文字段 `名称`、`描述` 仍是工作空间 Agent 摘要的主规范
- 现有 sender 资源协议可以继续承载 `builtin-command` 与 `workspace-agent`
- 现有会话模型允许增加“由对话发起、归属某工作空间”的子会话实体
- tool 渲染体系可以扩展专用工作空间委派卡片，而不必发明第二套消息系统

## 停手条件

- 如果子 Agent 会话无法作为独立会话或等价持久化实体存在，停止并回到 `workflow-spec`
- 如果主会话必须消费子 Agent 中间工具事件流才能完成当前架构，停止并回到 `workflow-spec`
- 如果 `/init` 仍无法通过标准 Agent / LLM 路径生成 `AGENTS.md`，停止并优先修复该链路
- 如果工作空间委派无法在消息流中建模为独立 tool，而只能退回普通 assistant 文本，停止并回到 `workflow-spec`

## 验证命令

```bash
pnpm lint
pnpm build
```

## 下一步

进入 `workflow-implement`，按上述阶段顺序执行，优先完成“现有实现纠偏”和“独立子 Agent 会话编排”两个关键切片，再推进委派 tool UI 与跳转。

## 实现进度

- 已完成阶段 2 的核心纠偏：`/init` 已从本地模板直写改为”工作空间扫描 -> 提示词构造 -> 真实 LLM 单轮生成 -> 最小结构校验 -> 写回 AGENTS.md”链路。
- 已补强阶段 2 的失败守护：当首轮 LLM 输出缺少 `名称`、`描述` 或关键章节时，`/init` 会基于缺失项自动发起一次受控修复重写，而不是首轮不合格就直接报错退出。
- 已完成阶段 3 的当前纠偏：`/init` 在 sender 中改为复用编辑器内资源标签，不再单独悬浮在输入框上方；发送链路补上异常兜底，避免 `/init` 失败时因未处理 Promise 导致界面直接白屏。
- 已完成阶段 4：独立子 Agent 会话编排。`delegateToWorkspaceAgent` 已重构为创建独立子会话，父会话通过 tool call + tool result 消息对记录委派结果，不再使用 plain assistant text。
- 已完成阶段 5：工作空间委派 tool 卡片与跳转。新增 `WorkspaceDelegateToolRenderer` + `WorkspaceDelegateRendererFactory`，已注册到 tool 渲染器。委派卡片显示工作空间名、Agent 名、状态和结果摘要，支持”查看子会话”按钮跳转到 `/:childSessionId`。
- 已完成子 Agent 审批透传：子 Agent 的工具审批（如 bash）会转发到父会话的 active stream，用户可在父会话中审批/拒绝，决策会透传给子 Agent。
- 已完成阶段 6.2：对话作用域系统提示词注入可用工作空间 Agent 索引（名称、工作空间、描述），主 Agent 可据此了解可委派目标。
- 阶段 6.3（LLM 驱动自动委派 tool）尚未实现，当前自动委派仍基于 `resolveTargetWorkspaceId` 的文本匹配。
- `pnpm lint`、`pnpm build`、`tsgo --noEmit` 均通过。
