## 1. 设计稿与现状对齐

- [x] 1.1 读取 [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) 中 “Willow / Tool Calls Gallery” 与 “Willow / Chat Output Rich” 的工具调用视觉结构。
- [x] 1.2 对照 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 校验工具 UI 的桌面工作台约束。
- [x] 1.3 梳理当前 `packages/ui` 工具 renderer 与 playground demo 的实现现状。

## 2. 共享工具卡片基座

- [x] 2.1 在 `packages/ui` 中设计并实现克制的工具卡片基座，覆盖容器、触发区、状态 badge、chevron 和展开 slot。
- [x] 2.2 为工具卡片基座补齐 keyboard/focus/disabled 语义。
- [x] 2.3 确保基座复用现有 token、`@willow/shadcn` 组件和 lucide 图标，不引入平行主题。
- [x] 2.4 为 `ToolCallCard` 增加 `loading?: boolean` 入参，并在 loading 为真时启动卡片级扫光效果。
- [x] 2.5 确保扫光不影响 hover、focus、disabled、error、展开/折叠和详情区域交互。
- [x] 2.6 在 reduced-motion 或动画不可见场景下，保证状态文案仍能表达运行中 / 等待中。

## 3. 专用 renderer 改造

- [x] 3.1 改造 Bash renderer，覆盖成功态、失败态、命令摘要和输出详情。
- [x] 3.2 改造 Web Search renderer，覆盖查询摘要、站点 pill、结果数量和 Markdown 结果详情。
- [x] 3.3 改造 Web Fetch renderer，覆盖目标地址、抓取状态、内容预览和长内容受控展示。
- [x] 3.4 改造 Todo renderer，覆盖 Todo Read / Todo Write 的统计摘要和任务明细。
- [x] 3.5 改造 Automation Create renderer，覆盖创建标题、计划时间、创建状态和次级打开动作。
- [x] 3.6 改造 Core Renderer 与 Default Fallback，统一通用工具和未知工具的降级卡片。
- [x] 3.7 为处于 running 或 pending 的工具 renderer 显式传入 `loading`，完成态和失败态不传入。

## 4. 主应用与审批提示

- [x] 4.1 在 `app/work` renderer 初始化中注册 `automation_create` 专用 renderer。
- [x] 4.2 调整 `ToolMessage.vue` 审批提示，使按钮使用 `@willow/shadcn`，并与工具卡片层级协调。
- [ ] 4.3 验证工具审批、pending、aborted 和 error 状态不会破坏工具卡片展示。

## 5. Playground 与样例数据

- [x] 5.1 更新 `app/ui-playground` 工具 demo 数据，覆盖设计稿要求的各工具类型。
- [x] 5.2 更新工具总览 demo，使其按 UI 稿展示普通态、hover 态、展开态和边界状态样张。
- [x] 5.3 确保 playground 页面壳仍符合 `DESIGN.md`，不复制平行静态 UI。
- [x] 5.4 还原 Todo 分组 UI：外层大卡片、分割线、Todo Read / Todo Write 内层样张卡片、工具调用样张中的图标、状态 pill、chevron、摘要和统计行。
- [x] 5.5 还原 Web Fetch 分组 UI：外层大卡片、分割线、`Web Fetch 工具状态` 区域、普通 / hover / 展开三态同时可见。
- [x] 5.6 在 playground 中补充至少一个 running 或 pending 的 `ToolCallCard` 扫光样张。
- [ ] 5.7 对照用户截图逐项校对圆角、阴影、字号、间距、状态 pill 位置和图标层级。

## 6. 验证

- [x] 6.1 运行 `pnpm lint`。
- [x] 6.2 运行影响范围需要的 build 检查，至少覆盖 `packages/ui` 与 `app/ui-playground`。
- [x] 6.3 使用 `pnpm dev:ui` 手动检查工具总览 demo。
- [x] 6.4 在主应用聊天页手动检查工具调用内联展示、审批提示和异常状态。
- [x] 6.5 手动检查 loading 扫光不会遮挡标题、状态、chevron、展开详情或审批提示。
- [x] 6.6 对照 [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) 与 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 做最终视觉校对。
