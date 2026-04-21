## 状态说明

- 当前 change 处于规格定义完成、待进入实现规划状态。
- 本次任务聚焦 `Sender` 独立成共享包与宿主适配边界，不扩展为聊天页整体抽包。

## 1. 包结构与边界

- [x] 1.1 在 `packages/` 下新增 `@willow/sender` 包，并定义入口导出、依赖与样式入口。
- [x] 1.2 识别 `Sender` 当前依赖中哪些属于共享层、哪些属于 `app/work` 宿主层。
- [x] 1.3 约束 `@willow/sender` 不反向依赖 `app/work` 源码、`@/` 别名、Electron IPC、Pinia 和 Vue Router。

## 2. 公共 API 设计

- [x] 2.1 为 `@willow/sender` 定义对外公开的组件导出与类型导出。
- [x] 2.2 设计宿主传入的模型、技能、usage 数据结构，以及 loading / error 状态输入。
- [x] 2.3 设计 `send`、`stop`、`open-settings`、模型切换、联网切换等事件接口。
- [x] 2.4 明确哪些状态保留在包内，哪些状态由宿主控制。

## 3. app/work 宿主适配

- [x] 3.1 为 `app/work` 设计轻量宿主容器，用于对接 store、IPC 和路由。
- [x] 3.2 明确 `Chat.vue` 如何从本地 `sender/index.vue` 切换到 `@willow/sender`。
- [x] 3.3 保证迁移后现有发送链路、停止链路和技能发现链路不回退。

## 4. 验证

- [x] 4.1 验证 `app/work` 中输入、发送、停止、模型切换、联网开关与 usage 展示仍可用。
- [x] 4.2 验证技能入口、slash 搜索、技能选择、技能移除和发送后清空行为保持一致。
- [x] 4.3 验证 `@willow/sender` 构建与导入时不再依赖 `app/work` 私有模块。
- [x] 4.4 如条件允许，验证 `app/ui-playground` 或最小示例可以接入 `@willow/sender`。
- [x] 4.5 对照 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 检查发送器仍符合桌面工作台输入器规范。

## 5. 交接

- [x] 5.1 进入 `workflow-worktree` 准备隔离实现环境。
- [x] 5.2 进入 `workflow-plan`，按“共享包实现、宿主容器适配、迁移替换、验证”四个切片拆解实施顺序。
