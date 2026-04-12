# add-automation-detail-page 执行计划

## 1. 计划目标

基于已批准的 OpenSpec 变更 `add-automation-detail-page`，把当前“自动化列表 + 只读详情 + 弹窗编辑”的实现，收敛为“自动化列表 + 可编辑详情页”的稳定工作流。

本次计划严格对应以下 OpenSpec 文档，不替代产品事实：

- `docs/ai-workflows/openspec/changes/add-automation-detail-page/proposal.md`
- `docs/ai-workflows/openspec/changes/add-automation-detail-page/design.md`
- `docs/ai-workflows/openspec/changes/add-automation-detail-page/specs/automation/spec.md`
- `docs/ai-workflows/openspec/changes/add-automation-detail-page/tasks.md`

## 2. 当前实现基线

当前仓库已经具备一部分基础能力，实施应以增量改造为主：

- 路由已存在：`app/work/src/renderer/src/router.ts`
  - 已有 `/auto`
  - 已有 `/auto/:automationId`
- 自动化详情页已存在：`app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
  - 当前为只读详情页
  - 页面动作仍依赖删除弹窗，编辑能力尚未迁入页面
- 自动化弹窗表单已存在：`app/work/src/renderer/src/layout/dialog/automation-form/AutomationForm.vue`
  - 已处理标题、工作空间、prompt、重复规则
  - 当前未处理状态和模型
  - 更新请求当前不会提交 `workspaceId`
- 自动化 store 已存在：`app/work/src/renderer/src/stores/automation.ts`
  - 已支持列表、详情、创建、更新、删除
- 模型配置体系已存在：
  - `app/work/src/renderer/src/stores/config.ts`
  - `app/work/src/main/service/config.service.ts`
  - `app/work/src/main/service/agent.service.ts`
- 当前自动化执行链路：
  - `AutomationService.runAutomationById()`
  - `SessionService.sendMessage(sessionId, { message, modelId })`
  - 已具备按 `modelId` 执行的基础能力

## 3. 已确认的实现边界

这次 OpenSpec 已经收敛为以下可执行边界：

- 自动化详情页可编辑：
  - 标题
  - 提示词
  - 状态
  - 工作空间
  - 重复规则
  - 执行模型
- 自动化新增最小执行配置：
  - `workspaceId` 可进入更新链路
  - 自动化新增可选 `modelId`
- `推理` 不作为自动化独立持久化字段
  - 详情页只展示“推理能力摘要”
  - 该摘要由当前所选模型或默认模型的 `reasoning` 字段推导
- 自动化运行时：
  - 若保存了 `modelId`，使用该模型执行
  - 若未保存 `modelId`，回退到默认模型

## 3.1 新增实现约束

本次编码必须保留当前详情页已经形成的视觉结果与信息编排，不做额外样式改造，只把现有静态展示替换为可编辑交互。

具体约束：

- 不重做页面骨架，不把现有详情页改成新的版式语言
- 不主动改变当前标题区、主内容区、右侧信息区的视觉层级
- 不为了“更像表单”新增大块新的卡片、装饰、阴影、背景或布局切换
- 优先在现有文本、badge、摘要位置就地替换为输入控件、下拉控件或受控反馈
- 如果某个字段必须新增控件，也要尽量贴合原位置、原尺寸和原密度

## 4. 依赖与风险

### 4.1 主要依赖

- 共享类型扩展：`app/work/src/shared/api.ts`
- 自动化控制器与 service 更新链路：
  - `app/work/src/main/controllers/automation/*.ts`
  - `app/work/src/main/service/automation.service.ts`
  - `app/work/src/main/service/dao/automation*.ts`
- 数据表扩展与迁移：
  - `app/work/src/main/db/schema.ts`
  - `app/work/src/main/db/migrations/*`
- renderer 页面与 store：
  - `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
  - `app/work/src/renderer/src/stores/automation.ts`
  - `app/work/src/renderer/src/stores/workspace.ts`
  - `app/work/src/renderer/src/stores/config.ts`

### 4.2 主要风险

- `modelId` 新增后，旧数据为空值时需要稳定回退到默认模型。
- 若自动化保存的 `modelId` 对应模型被删除，详情页和运行时都需要受控处理。
- 详情页与弹窗表单如果继续维护两套重复规则逻辑，后续极易出现 cron 推导不一致。
- 若实现过程中顺手重排布局或改动视觉层级，容易偏离“保留原有样式结果、只增加可编辑效果”的约束。

## 5. 执行切片

### 切片 A：扩展自动化数据模型与共享类型

目标：

- 为自动化补齐最小执行配置，使 renderer 和主进程都能读写 `workspaceId + modelId`

实现步骤：

1. 更新共享类型：
   - 为 `Automation` 增加 `modelId?: string | null`
   - 为 `UpdateAutomationRequest` 增加 `workspaceId?: number` 与 `modelId?: string | null`
   - 为 `CreateAutomationRequest` 评估是否同步增加 `modelId?: string`
2. 更新数据库 schema：
   - 为 `automations` 表新增可空 `model_id`
3. 添加数据库迁移，处理已有记录的默认空值
4. 更新 DAO 返回结构，确保新字段能透传到自动化详情与列表

涉及文件：

- `app/work/src/shared/api.ts`
- `app/work/src/shared/hook/automation.hook.ts`
- `app/work/src/main/db/schema.ts`
- `app/work/src/main/db/migrations/*`
- `app/work/src/main/service/dao/automation.dao.service.ts`

验证：

- 类型检查通过
- 读取自动化详情和列表时可见 `modelId`
- 旧数据在无 `modelId` 时仍能正常读取

停止条件：

- 自动化数据模型可完整表达详情页需要编辑和展示的执行配置

### 切片 B：打通自动化更新与执行链路

目标：

- 让自动化真正保存 `workspaceId + modelId`，并在运行时使用保存后的执行配置

实现步骤：

1. 扩展 `UpdateAutomationController` 参数校验与 request 映射
2. 扩展 `AutomationService.updateAutomation()`：
   - 校验 `workspaceId` 对应工作空间是否存在
   - 校验 `modelId` 是否存在或允许清空
   - 更新自动化记录
3. 扩展 `AutomationService.createAutomation()`：
   - 如果本次范围内需要支持新建时直接带模型，则同步写入 `modelId`
4. 扩展 `buildAutomationDetail()` 返回新字段
5. 更新 `AutomationService.runAutomationById()`：
   - 使用自动化保存的 `modelId`
   - 若为空则回退默认模型
6. 明确并实现失效模型的运行时行为：
   - 推荐行为：若保存的模型不存在，则回退默认模型，并在详情页中明确标识该模型失效

涉及文件：

- `app/work/src/main/controllers/automation/create.automation.controller.ts`
- `app/work/src/main/controllers/automation/update.automation.controller.ts`
- `app/work/src/main/service/automation.service.ts`
- `app/work/src/main/service/config.service.ts`
- `app/work/src/main/service/session.service.ts`

验证：

- 更新自动化后重新获取详情，`workspaceId / modelId` 为新值
- 自动化执行时传入正确 `modelId`
- 当 `modelId` 为空时仍可按默认模型执行

停止条件：

- 自动化执行配置与运行时已对齐，不再只是页面展示字段

### 切片 C：抽取重复规则编辑逻辑

目标：

- 复用当前弹窗中的 schedule 编辑能力，避免详情页和弹窗维护两套 cron 逻辑

实现步骤：

1. 审查 `AutomationForm.vue` 中可复用的逻辑：
   - `inferScheduleFromAutomation`
   - `scheduleMode`
   - `dailyTime / weeklyTime / weeklyDays / customCronExpression`
   - cron 表达式校验
2. 提取为可复用的 composable、util 或子组件
3. 让弹窗表单与详情页都依赖同一套 schedule 逻辑

涉及文件：

- `app/work/src/renderer/src/layout/dialog/automation-form/AutomationForm.vue`
- `app/work/src/renderer/src/components/automation/TimePicker.vue`
- 新增 `app/work/src/renderer/src/components/automation/*` 或 `composables/*`

验证：

- 日更、周更、自定义 cron 都能正确回填与提交
- 列表页与详情页展示的重复摘要一致

停止条件：

- schedule 逻辑只有一个可信来源

### 切片 D：重构详情页为页面级编辑态

目标：

- 将 `AutomationDetail.vue` 从只读详情改为可编辑详情页，同时尽量保留当前页面的视觉结果与布局骨架

实现步骤：

1. 基于详情快照创建本地页面表单状态
2. 主内容区改造为可编辑：
   - 标题输入
   - prompt `Textarea`
   - 优先保留原来的内容宽度、间距和阅读节奏
3. 右侧配置区改造为可编辑 / 可读混合结构：
   - 状态
   - 工作空间
   - 重复规则
   - 模型
   - 推理能力摘要
   - 下次运行 / 上次运行 / 最近执行摘要
   - 控件尽量内嵌到原有信息位，不新增新的视觉区块层级
4. 增加页面动作：
   - 保存
   - 返回或取消
   - 删除
5. 增加页面受控状态：
   - 加载中
   - 未找到
   - 脏状态
   - 保存中
   - 保存成功
   - 保存失败

涉及文件：

- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
- `app/work/src/renderer/src/components/automation/display.ts`
- `app/work/src/renderer/src/components/ui/*`

验证：

- 不打开弹窗即可编辑标题、prompt、状态、工作空间、重复规则、模型
- 保存失败后输入不丢失
- 未修改时保存按钮受控
- 与当前详情页相比，整体布局骨架、内容顺序和视觉层级保持稳定，没有额外样式重构

停止条件：

- 详情页成为主要编辑载体，不再依赖旧编辑弹窗承担核心编辑职责

### 切片 E：接入模型列表与推理摘要展示

目标：

- 让详情页基于真实模型配置显示模型名称、可选项和推理能力摘要

实现步骤：

1. 在详情页加载模型列表：
   - 若 `configStore.modelList` 为空则获取
2. 基于以下优先级解析“当前执行模型”：
   - 自动化保存的 `modelId`
   - 默认模型
3. 渲染以下状态：
   - 当前模型名称
   - 推理能力摘要
   - 默认模型回退提示
   - 已保存模型失效提示
4. 当用户切换模型时，推理摘要即时更新

涉及文件：

- `app/work/src/renderer/src/stores/config.ts`
- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
- 可能新增的显示 helper / util

验证：

- 切换模型后推理摘要即时变化
- 没有默认模型时出现明确占位
- 保存了失效模型时出现明确错误/提示状态

停止条件：

- 推理摘要不再是静态文案，而是由真实模型配置驱动

### 切片 F：补齐 store 与列表摘要同步

目标：

- 确保详情页保存后，详情数据、列表摘要和本地 store 一致

实现步骤：

1. 审查 `stores/automation.ts` 的更新逻辑
2. 确保 `updateAutomation()` 后同步更新：
   - `automationDetails`
   - `automationList`
3. 确保以下摘要都能反映最新值：
   - 标题
   - prompt 摘要
   - 状态
   - 工作空间
   - 重复摘要
4. 删除成功后返回 `/auto`

涉及文件：

- `app/work/src/renderer/src/stores/automation.ts`
- `app/work/src/renderer/src/pages/auto/Auto.vue`
- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`

验证：

- 从详情页保存后返回列表，摘要立即更新
- 无需刷新页面即可看到新值

停止条件：

- 列表和详情之间不存在“已保存但显示旧值”的状态分叉

### 切片 G：视觉收口与交互一致性

目标：

- 在符合 `DESIGN.md` 的前提下，保持当前详情页已有视觉结果，只补足可编辑交互和必要反馈

实现步骤：

1. 逐项对照当前详情页已有视觉结果，确认哪些地方只是“展示改编辑”，哪些地方真的需要增补反馈控件
2. 收口页面头部：
   - breadcrumb
   - 保存主按钮
   - 返回/取消次按钮
   - 删除弱化动作
   - 不额外引入新的视觉主操作样式
3. 保持主内容区的文字可读性和扫描效率，不额外改造主内容容器的视觉风格
4. 右侧区块继续沿用当前信息区的结构与密度，只在必要位置嵌入编辑控件
5. 控制卡片、边框、分割线和控件密度，避免出现“因为可编辑而重做样式”的情况

涉及文件：

- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
- 可能新增的局部组件
- `DESIGN.md`

验证：

- 页面只有一个清晰主操作
- 主内容和次级信息区层级清楚
- 没有多个同级高强调按钮或大片无信息留白
- 与改造前的详情页相比，样式结果基本保持一致，主要变化仅为交互控件替换与保存反馈

停止条件：

- 页面结构与 OpenSpec design 及 `DESIGN.md` 对齐

## 6. 建议实施顺序

推荐顺序：

1. 切片 A：扩展自动化数据模型与共享类型
2. 切片 B：打通自动化更新与执行链路
3. 切片 C：抽取重复规则编辑逻辑
4. 切片 D：重构详情页为页面级编辑态
5. 切片 E：接入模型列表与推理摘要展示
6. 切片 F：补齐 store 与列表摘要同步
7. 切片 G：视觉收口与交互一致性
8. 执行验证

## 7. 验证计划

### 工程验证

执行阶段至少运行：

- `pnpm lint`
- 相关构建命令
- `pnpm dev` 下的手动界面验证

### 手动验证

至少覆盖以下路径：

1. 从 `/auto` 点击列表项进入 `/auto/:automationId`
2. 使用 breadcrumb 或返回按钮回到列表
3. 修改标题并保存
4. 修改 prompt 并保存
5. 修改状态并保存
6. 修改工作空间并保存
7. 修改重复规则并保存
8. 修改模型并保存
9. 验证模型切换后推理摘要即时变化
10. 验证不存在的 `automationId`
11. 验证保存失败时输入仍保留
12. 删除自动化后返回列表
13. 对照改造前详情页，确认样式结果没有被整体重做，只是在原位置增加了可编辑效果

如有条件，还需额外验证：

1. 更新工作空间后，自动化执行在新的工作空间创建会话
2. 自动化保存 `modelId` 后，执行时使用该模型
3. 自动化未保存 `modelId` 时，执行回退默认模型
4. 已保存模型被删除后的详情页占位与回退行为

## 8. 执行出口

下一步进入 `workflow-implement`。
