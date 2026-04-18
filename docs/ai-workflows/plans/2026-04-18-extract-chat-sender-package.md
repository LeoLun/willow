# extract-chat-sender-package 实施计划

## 目标

基于 OpenSpec change `extract-chat-sender-package`，将 `app/work` 中现有聊天发送器拆分为共享 workspace 包 `@willow/sender`，并通过 `app/work` 宿主适配层接回现有模型、技能、发送与设置跳转能力。

本计划只描述实施顺序与执行约束，不新增产品行为。若实现过程中发现以下问题，需要回到 `workflow-spec`：

- 需要改变现有发送协议或技能协议
- 需要改变发送器视觉骨架或交互语义
- 需要把聊天页其他部分一并抽成共享包

## 当前基线

- 当前发送器主实现位于 [`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue)
- 当前直接使用点位于 [`app/work/src/renderer/src/pages/chat/Chat.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/Chat.vue)
- 现有共享 UI 包模式可参考 [`packages/ui/package.json`](/Users/liujinglun/code/willow/packages/ui/package.json) 与 [`packages/ui/src/index.ts`](/Users/liujinglun/code/willow/packages/ui/src/index.ts)
- 视觉规范以 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 为准

## 实施切片

### 切片 1：建立 `@willow/sender` 包骨架与公共 API

目标：

- 在 `packages/` 下新增可被 workspace 解析的 `@willow/sender`
- 明确包入口、样式入口、类型导出与组件导出
- 先建立稳定边界，再迁移实现

涉及文件 / 子系统：

- 新增 `packages/sender/package.json`
- 新增 `packages/sender/src/index.ts`
- 新增 `packages/sender/src/types.ts`
- 视实现需要新增 `packages/sender/src/style.css`
- 如需要，为包补充 `tsconfig.json`

实施步骤：

1. 对照 `packages/ui` 与 `packages/shadcn` 的现有约定，确定 `@willow/sender` 使用源码直出还是构建产物导出。
2. 在包内定义宿主无关的公开类型，至少覆盖：
   - `SenderModelOption`
   - `SenderSkillOption`
   - `SenderUsageLike` 或等价消息视图类型
   - `SenderSendPayload`
3. 在 `src/index.ts` 中导出 `Sender` 组件与类型，避免暴露包内实现路径。
4. 明确包依赖只包含共享层所需内容，如 `vue`、`@tiptap/*`、`@willow/shadcn`、`lucide-vue-next`。
5. 明确不允许引入 `app/work`、`@/`、`pinia`、`vue-router`、`window.electronAPI`。

验证：

- `pnpm` workspace 能解析 `@willow/sender`
- 包入口能被 TypeScript 正确识别
- 包源码中不存在对 `app/work` 或 renderer 私有别名的反向导入

停止条件：

- `@willow/sender` 已可被其他包或 app 通过包名导入
- 公共 API 形状已足以承接后续迁移，不再需要改动产品规格

### 切片 2：迁移共享发送器实现到包内

目标：

- 把现有 `Sender` 的 UI、编辑器逻辑和局部状态迁移进 `packages/sender`
- 将宿主耦合替换为 props / emits

涉及文件 / 子系统：

- 新增 `packages/sender/src/components/Sender.vue`
- 视需要新增 `packages/sender/src/components/CircularProgress.vue`
- 视需要新增包内工具函数文件
- 参考源实现：[`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue)

实施步骤：

1. 复制当前 `Sender` 的结构化编辑器与模板骨架到包内组件。
2. 将以下宿主依赖改为外部输入：
   - `modelList` / `defaultModel`
   - `getAvailableSkills()` 的返回结果
   - 设置页跳转动作
3. 将以下局部状态保留在包内：
   - 编辑器实例与草稿文本
   - slash 搜索上下文
   - 技能菜单开关
   - 当前高亮技能项
   - 已选技能集合
   - 未配置模型提示显示
4. 将 `@shared/api` 类型替换为包内视图类型，不把 Electron app 类型直接带入共享包。
5. 将 `cn` 等工具能力改为包内实现或共享安全依赖，避免继续引用 `@/lib/utils`。
6. 将 `CircularProgress` 迁移为包内内部组件或等价实现，避免依赖 `app/work` 本地组件。
7. 保持模板结构与交互语义不变：
   - 顶部技能胶囊区
   - 中部编辑区
   - 底部控制条
   - 右侧主发送按钮

验证：

- 包内组件可在类型层面接收模型、技能、消息与事件回调
- 发送按钮、停止按钮、模型下拉、联网开关、技能菜单和 slash 搜索逻辑仍能编译
- 包内不再引用任何 `app/work` 私有模块

停止条件：

- 共享发送器已在 `packages/sender` 中具备完整 UI 和交互逻辑
- 它已只依赖宿主传入数据与事件，不再自行拉取或导航

### 切片 3：在 `app/work` 新建宿主适配层

目标：

- 保持 `Chat.vue` 页面的消息发送链路基本不变
- 用一个轻量容器负责连接 store、IPC、router 与 `@willow/sender`

涉及文件 / 子系统：

- 新增 `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue` 或等价位置
- 更新 [`app/work/src/renderer/src/pages/chat/Chat.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/Chat.vue)
- 可能复用 [`app/work/src/renderer/src/lib/ipc.ts`](/Users/liujinglun/code/willow/app/work/src/renderer/src/lib/ipc.ts)
- 可能复用 `useConfigStore()` 与现有 `@shared/api` 类型

实施步骤：

1. 在宿主容器中读取 `useConfigStore()`，映射为 `@willow/sender` 需要的模型输入。
2. 在宿主容器中调用 `electronAPI.getAvailableSkills()`，维护技能列表、loading 与错误信息。
3. 在宿主容器中把“前往设置”映射为 `router.push("/setting")`。
4. 在宿主容器中接收 `@willow/sender` 发出的：
   - `send`
   - `stop`
   - `open-settings`
   - 模型 / 联网状态变更事件
5. 将共享包 payload 映射回现有 `SendMessage` 结构，再向页面透传。
6. 保证 `workspaceId` 变化时会刷新技能列表，但不把拉取逻辑回灌进共享包。

验证：

- 宿主容器可以独立编译
- `Chat.vue` 不再直接导入本地 `sender/index.vue`
- `Chat.vue` 现有 `handleSend` / `handleStop` 逻辑仍只关心业务发送，不重新吸收发送器内部状态

停止条件：

- `app/work` 侧已经通过适配层消费 `@willow/sender`
- store、IPC、router 相关逻辑只存在于宿主层

### 切片 4：迁移替换与清理旧实现

目标：

- 用共享包实现替换旧发送器引用
- 清理已废弃的本地主实现，避免双轨维护

涉及文件 / 子系统：

- 更新 `app/work` 中发送器使用点
- 删除或停用 [`app/work/src/renderer/src/components/base/sender/index.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/components/base/sender/index.vue)
- 如有必要，清理无用导入与局部类型

实施步骤：

1. 将 `Chat.vue` 的导入切换为宿主容器或直接切换为 `@willow/sender` 宿主接线组件。
2. 清理旧发送器实现文件，确认没有残余引用。
3. 清理已不再需要的本地辅助类型与依赖导入。
4. 检查是否存在遗留的样式或路径别名引用。

验证：

- `rg` 检查旧 `sender/index.vue` 不再作为主实现被引用
- renderer 编译路径只剩“共享包 + 宿主容器”的单一路径

停止条件：

- 仓库内不存在重复的发送器主实现来源
- 使用路径与维护路径收敛为单一实现

### 切片 5：补充复用验证与手动验证

目标：

- 验证 `app/work` 功能未回退
- 尽量验证 `@willow/sender` 在最小宿主或 playground 中可消费

涉及文件 / 子系统：

- `app/work`
- `app/ui-playground`
- `packages/sender`

实施步骤：

1. 先做静态验证：
   - `rg` 检查共享包无反向依赖
   - 检查导出入口与依赖声明
2. 做 workspace 级检查：
   - 运行与本次改动相关的 lint / build
3. 做 `app/work` 手动验证：
   - 普通文本输入与发送
   - 流式输出时停止按钮切换
   - 模型未配置提示与设置跳转
   - 联网开关切换
   - 技能列表加载成功、空态、错误态
   - slash 搜索、技能选择、删除、发送后清空
   - usage 展示在可用条件下仍正确出现
4. 如实现成本可控，在 `app/ui-playground` 新增一个最小 sender demo，验证共享包可在非 Electron 宿主中挂载。

验证：

- `pnpm lint`
- `pnpm build`
- 如 UI 改动较多，运行 `pnpm dev` 做 renderer 手动验证
- 如新增 playground demo，可运行 `pnpm dev:ui`

停止条件：

- OpenSpec tasks 中 4.x 对应验证项可被逐项勾验
- 没有发现需要回退到 `workflow-spec` 的新增产品决策

## 执行顺序

建议严格按以下顺序推进：

1. 切片 1：包骨架与公共 API
2. 切片 2：共享发送器迁移
3. 切片 3：`app/work` 宿主适配
4. 切片 4：替换旧实现并清理
5. 切片 5：验证与补充 demo

原因：

- 先锁定公共 API，能避免迁移中途反复返工
- 先让共享包独立，再接宿主，能更清楚地识别耦合点
- 清理旧实现必须放在宿主接线稳定之后

## 假设

- 当前 `app/work/src/shared/api.ts` 中的发送与技能协议已足以支撑宿主映射，不需要变更协议本身
- 当前 `sender` 只有 `Chat.vue` 一个直接消费点，迁移范围可控
- `app/ui-playground` 不是本次功能上线前置条件，但作为“可复用性验证”是有价值的加分项

## 依赖与阻塞项

- 依赖现有 `@tiptap/*`、`@willow/shadcn`、`lucide-vue-next` 在 workspace 中可直接复用
- 若 `packages/sender` 需要独立 `tsconfig.json` 或样式入口，应在切片 1 一次性补齐
- 若实现阶段发现共享包必须直接依赖 `@shared/api` 才能工作，这属于边界冲突，应暂停并回到 `workflow-spec`

## 完成定义

满足以下条件后，可进入 `workflow-implement`：

- 计划中的五个切片已无歧义
- 每个切片都有对应文件落点、验证方式和停止条件
- 没有悬而未决的产品决策或范围冲突

下一步：进入 `workflow-implement`，按本计划顺序实施 `extract-chat-sender-package`。
