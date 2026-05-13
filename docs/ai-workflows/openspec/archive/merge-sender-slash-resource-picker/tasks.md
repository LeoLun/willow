# Tasks: merge-sender-slash-resource-picker

## 1. OpenSpec 与设计确认

- [x] 1.1 阅读历史 `add-chat-skill-picker`，确认 `/` 技能选择、技能标签和 `selectedSkills` 语义。
- [x] 1.2 阅读历史 `add-sender-file-mention`，确认 `@` 文件选择、文件标签和 `selectedFiles` 语义。
- [x] 1.3 阅读历史 `add-sender-system-file-picker`，确认 `+` 系统文件选择入口必须保留。
- [x] 1.4 阅读根目录 `DESIGN.md`，确认 renderer 工作台视觉约束。
- [x] 1.5 检查 `ui/work.pen` 的 `Willow / Sender Component States` / `03 输入 / 后效果`，确认统一弹层视觉目标。

## 2. Sender 统一资源模型

- [x] 2.1 在 `@willow/sender` 类型中定义统一资源候选项或等价内部模型。
- [x] 2.2 保留现有 `SenderSkillOption`、`SenderFileOption`、`SenderSkillReference`、`SenderFileReference` 发送语义。
- [x] 2.3 为插件候选预留 host-provided 类型或选择事件，避免 sender 直接依赖插件运行时。

## 3. Trigger 与状态管理

- [x] 3.1 将 sender 的搜索触发符调整为仅注册 `/`。
- [x] 3.2 移除 `@` 文件面板触发行为，确保 `@` 可作为普通文本输入。
- [x] 3.3 将手动 `/` 工具栏入口接入统一资源选择器。
- [x] 3.4 取消或重定向独立工作空间文件手动入口，避免出现第二个文件搜索弹层。
- [x] 3.5 保持 `+` 系统文件选择入口不变。

## 4. 统一资源弹层

- [x] 4.1 新建 `ResourcePickerPanel.vue` 或等价组件，替代用户可见的独立技能 / 文件面板。
- [x] 4.2 按 `插件`、`技能`、`文件` 分组渲染候选项。
- [x] 4.3 支持一个查询同时过滤所有资源类型。
- [x] 4.4 支持加载、错误、空结果状态，且不阻断其他分组展示。
- [x] 4.5 实现跨分组的统一 active index、ArrowUp / ArrowDown / Enter / Escape 行为。

## 5. 选择与发送语义

- [x] 5.1 选择技能时删除 `/query`，插入现有 `SkillTag`，并保持去重。
- [x] 5.2 选择文件时删除 `/query`，插入现有 `FileTag`，并保持去重。
- [x] 5.3 发送时继续从编辑器标签生成 `selectedSkills` 和 `selectedFiles`。
- [x] 5.4 如实现插件选择，确保插件选择由宿主数据和事件驱动，不硬编码 UI 稿示例。

## 6. 视觉还原

- [x] 6.1 弹层位置、宽度、圆角、边框、阴影与 `work.pen` 的 `03 输入 / 后效果` 对齐。
- [x] 6.2 分组标题、行高、图标、活动项浅底状态与 UI 稿保持一致。
- [x] 6.3 输入器保持单个一体式容器，底部工具栏保持紧凑稳定。
- [x] 6.4 使用现有 token、`@willow/shadcn` 和 lucide 图标，不新增平行主题。

## 7. 验证

- [x] 7.1 手动验证输入 `/` 打开单个统一资源弹层。
- [x] 7.2 手动验证 `/query` 同时过滤技能和文件；有插件数据时也过滤插件。
- [x] 7.3 手动验证输入 `@` 不打开文件面板。
- [x] 7.4 手动验证键盘导航可跨分组移动并选择候选项。
- [x] 7.5 手动验证选择技能、文件后的标签、去重、发送 payload 均保持正确。
- [x] 7.6 手动验证 `+` 系统文件选择器行为不回退。
- [x] 7.7 对触及代码运行 `pnpm lint`。
- [x] 7.8 如修改共享包类型或构建输出，运行 `pnpm build`。
