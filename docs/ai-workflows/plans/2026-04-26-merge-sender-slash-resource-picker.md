# merge-sender-slash-resource-picker 实施计划

## Summary

将 `@willow/sender` 当前分离的 `/` 技能选择和 `@` 工作空间文件选择合并为一个 `/` 统一资源选择器。统一弹层按 `插件`、`技能`、`文件` 分组展示候选项，选择后继续复用现有 `SkillTag`、`FileTag`、`selectedSkills` 和 `selectedFiles` 语义。`@` 不再触发文件面板，作为普通文本保留。左下 `+` 系统文件选择入口保持不变。

本计划只覆盖 OpenSpec `merge-sender-slash-resource-picker`。不实现插件安装、文件内容读取、附件上传，也不改变模型选择、联网开关、发送 / 停止或“仅文件标签不可发送”的既有规则。

## Key Changes

- 在 `packages/sender/src/types.ts` 增加 host-provided 插件候选类型，例如 `SenderPluginOption`，只用于统一弹层展示和选择事件边界。
- 在 `packages/sender/src/components/Sender.vue` 中把触发器调整为仅注册 `/`，删除 `FILE_TRIGGER = "@"` 的文件搜索触发路径。
- 新增 `packages/sender/src/components/ResourcePickerPanel.vue`，替代用户可见的 `SkillPickerPanel` / `FilePickerPanel` 双面板。
- 统一面板内部按 `插件`、`技能`、`文件` 分组，维护一个扁平化可见结果列表供键盘导航和 Enter 选择。
- 工具栏保留 `+` 系统文件选择按钮，将当前技能按钮调整为 `/` 统一资源入口，并移除独立工作空间文件搜索按钮。
- 更新 sender placeholder 与 ui-playground 文案，避免继续提示 `@ 添加文件`。
- 在 `app/ui-playground` 的 Sender demo 中补充插件候选 mock，仅用于验证分组展示；不把 mock 写进生产宿主。
- 如 `app/work` 暂无稳定插件来源，则先不向生产 `SenderContainer` 传 `plugins`，统一弹层应自动隐藏空插件分组。

## Execution Slices

### Slice 1: 类型与现状保护

1. 在 `packages/sender/src/types.ts` 新增插件展示类型：
   - `SenderPluginOption` 至少包含 `name`、`description`。
   - 可选 `id`、`icon` 等展示字段，但不引入运行时依赖。
2. 保持现有 `SenderSkillOption`、`SenderFileOption`、`SenderSkillReference`、`SenderFileReference` 和 `SenderSendPayload` 字段不变。
3. 在 `packages/sender/src/index.ts` 确认新类型被导出。
4. 不新增 `selectedPlugins` 到发送 payload，除非实现阶段发现已有明确宿主语义；当前 OpenSpec 只要求插件候选 host-owned，不要求本次完成插件发送链路。

完成条件：类型边界支持插件分组展示，同时不改变技能和文件现有发送协议。

### Slice 2: 统一资源面板组件

1. 新建 `ResourcePickerPanel.vue`。
2. Props 覆盖：
   - `plugins`、`pluginsLoading`、`pluginsErrorMessage`
   - `skills`、`skillsLoading`、`skillsErrorMessage`
   - `files`、`filesLoading`、`filesErrorMessage`
   - `query`、`activeIndex`、`selectedSkillKeys`、`selectedFileKeys`、`isSearchMode`
3. 在组件内计算三个分组的过滤结果：
   - 插件按 `name description`。
   - 技能按 `name description`。
   - 文件按 `name relativePath`。
4. 计算 `visibleItems` 扁平列表，每项包含 `type` 与原始对象，用于跨分组 active index。
5. 暴露 `visibleItems`，供 `Sender.vue` 在 ArrowDown 和 Enter 时读取结果数量和当前项。
6. 渲染规则：
   - 分组顺序固定为 `插件`、`技能`、`文件`。
   - 无候选、非 loading、非 error 的分组隐藏。
   - loading / error 以分组内短状态展示，不阻断其他分组。
   - 全部无匹配时展示 `没有匹配的资源。`
7. 视觉规则：
   - 单个 `absolute right-0 bottom-[calc(100%_+_0.625rem)] left-0` 浮层。
   - `rounded-xl border border-border bg-card shadow-lg`。
   - 分组标题使用灰色小号字。
   - 行布局为图标 + 名称 + 描述或路径，长文本截断。
   - active 行使用浅底状态，不使用强品牌色。

完成条件：统一面板可独立显示插件、技能、文件分组，并暴露跨分组结果列表。

### Slice 3: Sender 触发器与键盘导航

1. 在 `Sender.vue` 中移除 `FILE_TRIGGER = "@"`。
2. `useTriggerManager()` 只注册 `{ char: "/", pattern: /(\/\S*)$/ }`。
3. 删除 `isSkillPanelVisible`、`isFilePanelVisible` 分支，改为 `isResourcePanelVisible`。
4. 将 `skillPickerPanelRef` 和 `filePickerPanelRef` 替换为 `resourcePickerPanelRef`。
5. ArrowDown：
   - 使用 `resourcePickerPanelRef.value?.visibleItems.length ?? 1` 计算 `maxIndex`。
   - 继续调用 `triggerManager.navigateDown(maxIndex)`。
6. Enter：
   - 读取当前 `visibleItems[activeIndex]`。
   - `type === "skill"` 时调用现有技能选择逻辑。
   - `type === "file"` 时调用现有文件选择逻辑。
   - `type === "plugin"` 时调用插件选择事件或关闭弹层；若暂未接入插件选择事件，不应插入假数据。
7. Escape 保持关闭统一弹层并重置 active index。
8. 验证输入 `@` 不会命中任何 trigger；`@` 留在正文中。

完成条件：sender 只存在 `/` 一个资源搜索触发，键盘导航可跨插件、技能、文件分组移动。

### Slice 4: 选择行为复用

1. 保留 `handleSkillSelect(skill)` 的核心语义：
   - 用 `scope:filePath` 去重。
   - 删除 `/query`。
   - 关闭面板。
   - 插入现有 `SkillTag`。
2. 保留 `insertFiles(files)` 的核心语义：
   - 用 `path` 去重。
   - 插入现有 `FileTag`。
   - 同步 `editorFileKeys`。
   - 恢复编辑器焦点。
3. 调整 `handleFileSelect(file)`：
   - 删除 `/query`，而不是旧的 `@query`。
   - 关闭统一面板。
   - 复用 `insertFiles([file])`。
4. 保持发送逻辑继续从编辑器标签生成 `selectedSkills` 和 `selectedFiles`。
5. 保持 `handleSystemFileSelect()` 不变：点击 `+` 关闭资源面板，并发出 `select-files(insertFiles)`。

完成条件：通过统一 `/` 面板选择技能和文件后，标签、去重和 send payload 与旧行为一致。

### Slice 5: 工具栏与文案

1. 工具栏第一项继续为 `PlusIcon`，点击系统文件选择，`sr-only` 为 `添加文件`。
2. 将当前 `BlocksIcon` 技能按钮改为 `/` 统一资源入口：
   - 点击 `triggerManager.toggleManualPanel("/")`。
   - 按钮视觉贴近 `work.pen` 中的 `/` 文本入口，可使用文本 `/` 或合适图标加 `sr-only`。
   - `sr-only` 使用 `选择资源` 或 `打开资源选择器`。
3. 移除独立 `FileTextIcon` 工作空间文件按钮，避免第二个文件搜索入口。
4. 更新 `Editor.vue` placeholder：
   - 从 `向 AI 提问，@ 添加文件，/ 使用技能`
   - 改为类似 `向 AI 提问，/ 选择技能或文件`
5. 更新 `app/ui-playground/src/demos/scenes/SenderDemo.vue` 中的徽章、说明和验证文案，去掉 `@ 文件引用` 的入口描述。

完成条件：工具栏结构与 `work.pen` 对齐，用户不会再看到 `@` 文件选择提示。

### Slice 6: Host 数据接入与 playground 验证

1. 在 `app/ui-playground/src/demos/mock-data.ts` 新增 `senderPlugins` mock：
   - 示例只用于 demo，例如 `Browser Use`。
   - 数据从 demo 文件传入，不写入 sender 默认值。
2. 在 `SenderDemo.vue` 向 `Sender` 传入 `plugins`，用于验证 `插件` 分组。
3. 在 `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue` 暂不传插件，除非已有可复用插件列表来源；统一面板应隐藏空插件分组。
4. 如果实现阶段发现 app/work 已有明确插件数据源，可以只做只读映射：
   - 不让 sender 导入 app/work 模块。
   - 不扩展发送链路。
   - 不硬编码 UI 稿示例。

完成条件：ui-playground 能展示三分组；生产 app 在无插件 props 时仍可展示技能和文件分组。

### Slice 7: 清理旧面板路径

1. 从 `Sender.vue` 移除 `SkillPickerPanel` 与 `FilePickerPanel` 的 import 和模板渲染。
2. 若 `SkillPickerPanel.vue`、`FilePickerPanel.vue` 已无引用：
   - 可删除，降低维护成本。
   - 或保留但不作为用户可见路径；推荐删除以避免双面板回流。
3. 使用 `rg "FilePickerPanel|SkillPickerPanel|FILE_TRIGGER|@\\S"` 检查旧触发逻辑是否残留。
4. 使用 `rg "@ 添加文件|@ 文件|输入 @|@ 文件引用"` 检查用户文案是否仍误导。

完成条件：代码中不再存在可打开 `@` 文件搜索面板的路径。

### Slice 8: 视觉与行为验证

1. 启动 ui-playground：
   - `pnpm dev:ui`
2. 在 Sender demo 手动验证：
   - 输入 `/` 后只出现一个统一弹层。
   - 弹层按 `插件`、`技能`、`文件` 分组。
   - 输入 `/work` 或其他查询能同时过滤多类资源。
   - 输入 `@` 不打开任何文件面板。
   - ArrowUp / ArrowDown 跨分组移动 active 行。
   - Enter 选择技能后插入技能标签。
   - Enter 选择文件后插入文件标签。
   - 重复选择同一技能或文件不会重复插入。
   - 发送 payload 包含 `selectedSkills` 和 `selectedFiles`。
3. 视觉对照 `ui/work.pen`：
   - 弹层是单个 command palette。
   - 宽度与输入器对齐。
   - 活动行浅底、分组标题灰色、行高紧凑。
   - 底部工具栏只保留 `+`、`/`、联网、模型选择、发送等核心项。
4. 如需要浏览器截图验证，可使用 in-app browser 打开 ui-playground 本地地址进行人工检查。

完成条件：交互和视觉满足 OpenSpec 成功标准。

### Slice 9: 自动检查

1. 运行 `pnpm lint`。
2. 如修改共享包导出、类型或构建入口后影响包构建，运行 `pnpm build`。
3. 若 lint 或 build 失败：
   - 优先修复本次变更引入的问题。
   - 若失败来自工作区既有无关改动，记录具体命令和失败摘要，不回滚用户改动。

完成条件：相关检查通过，或明确记录非本次变更导致的阻塞。

## File Touch List

预计触及：

- `packages/sender/src/types.ts`
- `packages/sender/src/index.ts`
- `packages/sender/src/components/Sender.vue`
- `packages/sender/src/components/Editor.vue`
- `packages/sender/src/components/ResourcePickerPanel.vue`
- `app/ui-playground/src/demos/mock-data.ts`
- `app/ui-playground/src/demos/scenes/SenderDemo.vue`

可能删除：

- `packages/sender/src/components/SkillPickerPanel.vue`
- `packages/sender/src/components/FilePickerPanel.vue`

通常不需要修改：

- `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue`

只有在已有明确插件数据来源时，才考虑给 `SenderContainer.vue` 增加只读插件 props 映射。

## Assumptions

- 当前 `+` 系统文件选择入口已经可用，本次只需保证不回退。
- 当前文件和技能标签的 Tiptap extension、Markdown 文本输出、payload 提取语义保持可复用。
- `app/work` 目前未确认存在稳定插件候选数据源；因此生产宿主可以暂不显示插件分组，ui-playground 用 mock 验证组件能力。
- 插件选择的发送语义不在本次 OpenSpec 明确范围内；本次不能发明新的 `selectedPlugins` 运行协议。
- `@` 取消文件触发是明确产品要求，不需要保留兼容触发。

## Stop Conditions

- 如果实现插件分组必须引入 app/work、Electron、MCP 或插件运行时到 `@willow/sender`，停止并回到 `workflow-spec`。
- 如果为了展示插件而必须硬编码 UI 稿中的 `Browser Use` 到生产代码，停止并调整方案。
- 如果移除 `@` 触发会破坏文件标签插入或 `selectedFiles` 发送语义，先修复复用路径；不要改发送协议绕过问题。
- 如果需要改变“仅文件标签且无正文不可发送”规则，停止并回到 `workflow-spec`。
- 如果统一面板需要改变现有技能或文件 Markdown 文本格式，停止并回到 `workflow-spec`。

## Verification Commands

```bash
pnpm lint
pnpm build
```

手动 UI 验证优先使用：

```bash
pnpm dev:ui
```

## Implementation Progress

- 已完成 Slice 1-7：类型边界、统一资源面板、`/` 单触发、选择复用、工具栏文案、playground mock、旧双面板路径清理。
- 已完成自动验证：`pnpm lint`、`pnpm --filter @willow/ui-playground exec vite build`、`pnpm build`、`pnpm --filter willow-work exec vite build --config vite.renderer.config.ts`。
- 手动 UI 验证尚未完成：当前环境启动 `pnpm dev:ui` 时本地端口监听被拒绝，报 `listen EPERM: operation not permitted 127.0.0.1:4173`。需要在允许本地 dev server 的环境补验 Slice 8 的交互项。
