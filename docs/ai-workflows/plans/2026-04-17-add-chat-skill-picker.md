# 2026-04-17 add-chat-skill-picker

## 背景

本计划对应 OpenSpec change `add-chat-skill-picker`，目标是在不偏离既有需求的前提下，把聊天输入区升级为基于 Tiptap 的一体式工作台输入器，并补齐技能发现、slash 搜索、来源标签和发送链路。

本计划只描述执行顺序、改动切片、验证方式和停机条件，不新增任何产品行为。

## 当前进度

- 已完成切片一：协议与技能发现
- 已完成切片二：输入器骨架与 Tiptap 基础编辑
- 已完成切片三：技能选择、slash 搜索与来源标签
- 已完成切片四：发送链路与 prompt 组装
- 切片五仍保留人工联调与最终视觉验收

相关真相源：

- [`proposal.md`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/add-chat-skill-picker/proposal.md)
- [`design.md`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/add-chat-skill-picker/design.md)
- [`spec.md`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/add-chat-skill-picker/specs/chat-skill-picker/spec.md)
- [`tasks.md`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/add-chat-skill-picker/tasks.md)
- [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md)

## 当前实现快照

- renderer 输入器当前集中在 [`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue)，仍基于 `InputGroupTextarea`
- 聊天页壳层在 [`app/work/src/renderer/src/pages/chat/Chat.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/Chat.vue)，负责把 `Sender` 发出的 `SendMessage` 转交给 `electronAPI.sendMessage`
- shared 协议在 [`app/work/src/shared/api.ts`](/Users/liujinglun/code/willow/app/work/src/shared/api.ts)，当前 `SendMessageRequest` 只包含 `message` / `modelId` / `webSearchEnabled`
- 主进程发送链路在 [`app/work/src/main/service/session.service.ts`](/Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts)，当前直接 `agent.prompt(data.message)`
- 技能加载逻辑已存在于 [`packages/core/src/skills.ts`](/Users/liujinglun/code/willow/packages/core/src/skills.ts)，并由 [`app/work/src/main/service/agent.service.ts`](/Users/liujinglun/code/willow/app/work/src/main/service/agent.service.ts) 通过 `cwd` 与 `userData` 间接启用
- 当前 `app/work/package.json` 中未见 Tiptap 相关依赖，实施时需要显式补充依赖安装与导入验证

## 执行策略

采用四个最小安全切片：

1. 先补协议与技能发现接口，建立 renderer 可消费的数据面
2. 再改输入器骨架和 Tiptap 编辑区，但先不依赖最终 prompt 注入即可验证交互
3. 接着接通主进程发送链路，把选中技能转成受控上下文
4. 最后做联调、空态、视觉收口与回归验证

这样可以避免以下风险：

- 先重做输入器 UI，结果没有技能数据可接
- 先改发送链路，结果前端还没有稳定结构化 payload
- 把 slash 搜索、来源标签、发送 prompt 和流式停止混在同一批里一起排错

## 切片一：协议与技能发现

### 目标

让 renderer 能在当前聊天上下文下拿到可展示、可搜索、可发送验证的技能摘要集合。

### 涉及文件 / 子系统

- [`app/work/src/shared/api.ts`](/Users/liujinglun/code/willow/app/work/src/shared/api.ts)
- [`app/work/src/shared/constants.ts`](/Users/liujinglun/code/willow/app/work/src/shared/constants.ts)
- [`app/work/src/shared/index.ts`](/Users/liujinglun/code/willow/app/work/src/shared/index.ts)
- [`app/work/src/preload/preload.ts`](/Users/liujinglun/code/willow/app/work/src/preload/preload.ts)
- `app/work/src/main/controllers/` 下新增技能查询 controller
- `app/work/src/main/service/` 下新增或补充技能查询 service
- [`packages/core/src/skills.ts`](/Users/liujinglun/code/willow/packages/core/src/skills.ts)

### 实施步骤

1. 在 shared API 中新增技能摘要类型，至少包含 `name`、`description`、`filePath`、`scope`、`scopeLabel`。
2. 新增“查询当前上下文技能列表”的 IPC 请求与响应类型。
3. 在 preload 暴露对应 `electronAPI` 方法，保持与现有 `getWorkspaceFiles` / `getWorkspaceSettings` 的调用风格一致。
4. 在 main 进程增加技能发现能力，优先复用 `@willow/core` 现有目录和冲突规则，而不是重新发明扫描逻辑。
5. 约束返回结果：
   当前有工作空间时返回全局技能 + 当前工作空间技能；没有工作空间时仅返回全局技能。
6. 在服务层补足 `scopeLabel` 派生，避免 renderer 重复判断中文显示文案。

### 验证

- 能在 renderer 侧拿到结构稳定的技能列表。
- 仅全局技能、仅工作空间技能、二者并存时返回结构都正确。
- 同名技能冲突时，返回结果与 `packages/core` 当前优先级一致。

### 停止条件

- `electronAPI` 已经可以查询技能摘要。
- renderer 不需要直接读文件系统也能拿到完整技能列表。

## 切片二：输入器骨架与 Tiptap 基础编辑

### 目标

把当前 `Sender` 从普通 textarea 升级为参考图中的一体式输入器，同时保留发送 / 停止 / 模型切换 / 联网开关 / token 展示。

### 涉及文件 / 子系统

- [`app/work/package.json`](/Users/liujinglun/code/willow/app/work/package.json)
- [`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue)
- 可新增：
  `app/work/src/renderer/src/components/base/sender/` 下的编辑器、技能胶囊、搜索面板等子组件
- 如有需要，补充 composable 管理输入器状态

### 实施步骤

1. 安装并接入 Tiptap 的最小依赖集，只启用满足当前规格的基础扩展。
2. 将 `Sender` 重构为三段式骨架：
   顶部技能胶囊区、中部编辑区、底部控制条。
3. 保持现有模型下拉、联网按钮、发送 / 停止按钮和 token 用量展示不回退。
4. 抽离编辑器纯文本读取与清空逻辑，确保空消息校验不依赖 DOM 文本猜测。
5. 为后续 slash 搜索和技能选择预留受控状态：
   `selectedSkills`、`slashQuery`、`isSkillSearchOpen`。

### 验证

- 不选择技能时，输入、发送、停止行为与当前版本一致。
- 切换侧栏、切换会话、流式输出中停止，不会导致编辑器状态异常。
- 输入器外观符合“顶部胶囊 + 中部编辑区 + 底部控制条 + 右侧发送按钮”骨架。

### 停止条件

- `Sender` 已切换到 Tiptap。
- 基础聊天功能在不启用技能选择时保持可用。

## 切片三：技能选择、slash 搜索与来源标签

### 目标

把技能查询结果接进输入器，支持点击入口浏览与 `/...` 搜索，并在结果项末尾稳定展示来源标签。

### 涉及文件 / 子系统

- [`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue)
- 新增技能选择列表 / 搜索结果组件
- 可新增 renderer composable 管理技能查询与筛选缓存

### 实施步骤

1. 在 `Sender` 挂载技能列表请求，按当前工作空间上下文刷新。
2. 为 `Plus` 入口接入技能浏览面板，支持普通点击打开。
3. 为 Tiptap 编辑区增加 slash 搜索监听：
   当检测到 `/` 开头的查询片段时进入技能搜索态。
4. 按名称与描述实时过滤结果，确保 `/sp` 一类查询能快速缩小范围。
5. 搜索结果项按三段式渲染：
   左侧图标，中部名称与描述，右侧来源标签。
6. 结果项选中后：
   删除或吞掉 slash 查询文本，转成顶部技能胶囊，并关闭搜索面板。
7. 支持移除已选技能，并确保多技能时顶部胶囊区仍保持有序换行。
8. 空态单独处理：
   无全局技能、无工作空间、当前工作空间无技能、过滤后无结果。

### 验证

- 点击入口能看到技能列表。
- 输入 `/sp` 等查询时结果会实时过滤。
- 选中结果后 slash 文本不会残留为普通正文。
- 每个结果项最右侧都显示 `全局` 或 `工作空间`，且来源判断正确。

### 停止条件

- 前端技能选择交互闭环完成。
- 来源标签与 slash 搜索行为都符合 OpenSpec。

## 切片四：发送链路与 prompt 组装

### 目标

把前端的已选技能真正带入发送协议，并在主进程中转成受控上下文，而不是只做 UI 展示。

### 涉及文件 / 子系统

- [`app/work/src/shared/api.ts`](/Users/liujinglun/code/willow/app/work/src/shared/api.ts)
- [`app/work/src/preload/preload.ts`](/Users/liujinglun/code/willow/app/work/src/preload/preload.ts)
- [`app/work/src/main/controllers/session/send.messgae.controller.ts`](/Users/liujinglun/code/willow/app/work/src/main/controllers/session/send.messgae.controller.ts)
- [`app/work/src/main/service/session.service.ts`](/Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts)
- 如有必要，新增 main util 负责 prompt 前缀组装和技能重校验
- [`app/work/src/renderer/src/pages/chat/Chat.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue)

### 实施步骤

1. 扩展 `SendMessageRequest` / `SendMessage`，加入本轮选中技能列表。
2. 更新 `Sender` 的 `emit("send")` 结构，发送正文纯文本 + 选中技能。
3. 更新 `Chat.vue` 到 `electronAPI.sendMessage` 的透传，确保新字段不在壳层丢失。
4. 在主进程发送前重新获取当前可用技能集合，并按 `name` + `filePath` + `scope` 校验选中技能。
5. 仅把校验通过的技能拼装进受控 prompt 前缀块，再与用户正文拼接后传给 `agent.prompt(...)`。
6. 对失效技能做受控降级：
   可忽略失效项，但正文仍应继续发送；必要时给出明确错误信息。
7. 发送成功后，前端清空本轮已选技能与编辑器草稿；发送失败时保留草稿供用户重试。

### 验证

- 已选技能会进入 IPC payload，而不是仅停留在前端状态。
- 主进程对失效技能能重新校验并安全降级。
- 未选技能时消息发送链路与当前版本一致。
- 首轮创建会话与已有会话两条路径都能正确携带选中技能。

### 停止条件

- UI 中的技能选择已经影响实际 agent 输入。
- 发送成功清空、发送失败保留的行为稳定。

## 切片五：联调、回归与视觉验收

### 目标

在真实聊天流中完成功能回归、视觉收口和设计对齐，避免新输入器破坏原有工作台体验。

### 涉及文件 / 子系统

- `app/work/src/renderer/src/components/base/sender/` 相关组件
- `app/work/src/renderer/src/pages/chat/Chat.vue`
- 与消息流、会话创建、流式停止相关的现有逻辑

### 实施步骤

1. 手动走查无技能的普通聊天路径。
2. 手动走查仅全局技能、仅工作空间技能、混合技能的查询与选择路径。
3. 手动走查 slash 搜索、结果高亮、选择、移除、重新选择。
4. 手动走查新会话首发消息与已有会话追加消息。
5. 手动走查流式输出中点击停止后的输入器状态恢复。
6. 对照参考图和 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 收口视觉：
   一体式容器、顶部胶囊、底部操作带、右侧主按钮、结果列表来源标签。
7. 运行最小必要命令验证类型和静态质量，至少覆盖 lint / 构建中与本改动相关的命令。

### 建议验证命令

- `pnpm lint`
- `pnpm build`
- 如依赖安装新增，先执行 `pnpm install`

### 停止条件

- OpenSpec `tasks.md` 中 1.x、2.x、3.x、4.x 条目均可被实际验证覆盖。
- 没有剩余“仅 UI 可见但链路未接通”的半成品状态。

## 依赖与阻塞项

- Tiptap 依赖当前尚未在 `app/work/package.json` 中声明，实施前需要补依赖并确认与现有 Vue 版本兼容。
- 技能发现接口属于新增 IPC 能力，需要同步更新 shared type、preload 和 main controller；这是一组必须同批落地的耦合改动。
- 当前 `packages/core/src/skills.ts` 的合并优先级是“全局先于工作空间”，计划默认沿用该语义；若实现阶段发现产品希望改变优先级，必须回到 `workflow-spec`。

## 假设

- 本次不为 `/skills` 路由补完整技能管理页面。
- 本次不支持富文本格式工具栏、图片块、文件块和代码块。
- 本次只把已选技能转成主进程受控 prompt 上下文，不修改 `@willow/core` 的底层系统提示拼装逻辑。

## 执行顺序总结

推荐按以下顺序实施：

1. 切片一：协议与技能发现
2. 切片二：输入器骨架与 Tiptap 基础编辑
3. 切片三：技能选择、slash 搜索与来源标签
4. 切片四：发送链路与 prompt 组装
5. 切片五：联调、回归与视觉验收

## 下一步

进入 `workflow-implement`，严格按本计划顺序实施；如果实现中发现“技能来源优先级”、“失效技能失败策略”或“slash 搜索触发边界”与 OpenSpec 不一致，先回到 `workflow-spec` 补齐后再继续编码。
