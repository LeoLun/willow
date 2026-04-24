# add-sender-system-file-picker 实施计划

## Summary

为聊天发送器左下工具栏新增 `+` 系统文件添加入口。点击后由 `app/work` 通过 Electron 系统文件选择器选择一个或多个文件，再把选择结果交回 `@willow/sender`，复用现有文件标签插入、去重、`message` 文本和 `selectedFiles` payload 语义。

本计划只覆盖 OpenSpec `add-sender-system-file-picker`。不实现文件内容读取、上传、拖拽、粘贴文件或附件管理面板。

## Key Changes

- 在 `app/work/src/shared/constants.ts` 新增 `SELECT_FILES` IPC 常量。
- 在 `app/work/src/shared/api.ts` 新增 `SelectedSystemFile`、`SelectFilesRequest`、`SelectFilesResponse` 类型。
- 在 `app/work/src/shared/hook/dialog.hook.ts` 扩展 `IDialogRenderer.selectFiles()`。
- 在 `app/work/src/main/controllers/dialog.controller.ts` 新增 `selectFiles` IPC 方法，使用 Electron `dialog.showOpenDialog()`，只允许文件选择，支持多选。
- 在 `app/work/src/preload/preload.ts` 暴露 `electronAPI.selectFiles()`，按现有 API 风格处理 `ApiResponse` 和错误。
- 在 `packages/sender/src/components/Sender.vue` 新增 `select-files` emit 或等价受控插入 API；优先采用 OpenSpec 推荐的回调式事件：`select-files(insertFiles)`。
- 在 `Sender.vue` 中把左下 `+` 按钮改为系统文件选择入口；技能手动入口更换为非 `+` 的 lucide 技能/工具图标；工作区文件入口继续打开现有 `@` 文件面板。
- 在 `Sender.vue` 中抽出批量插入函数，复用现有 `handleFileSelect` 的去重和 `Editor.insertFileTag()` 行为，保证系统选择文件与 `@` 文件的标签效果一致。
- 在 `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue` 监听 sender 文件选择请求，调用 `electronAPI.selectFiles({ multiSelections: true })`，把结果映射为 `SenderFileOption[]` 后交回 sender 插入。
- 对工作空间内文件复用现有 `getRelativePath(path, rootPath)`；对工作空间外文件使用文件名作为 `relativePath` 展示值，完整本地路径保留在 `path`。

## Execution Slices

### Slice 1: Dialog IPC 与类型边界

1. 在 `constants.ts` 增加 `SELECT_FILES`，命名与现有 IPC 常量保持一致。
2. 在 `api.ts` 增加系统文件选择相关类型。
3. 在 `dialog.hook.ts` 增加 `selectFiles(request?: SelectFilesRequest): Promise<SelectFilesResponse>`。
4. 在 `dialog.controller.ts` 新增 `@IPC(SELECT_FILES)` 方法：
   - `properties` 至少包含 `"openFile"`。
   - `multiSelections !== false` 时追加 `"multiSelections"`。
   - 取消时返回 `{ code: 0, msg: "ok", data: { selected: false, files: [] } }`。
   - 确认时用 `basename`、`extname` 和可选 `stat` 生成 `SelectedSystemFile[]`；如果读取 size 失败，不阻断选择。
5. 在 `preload.ts` 补充类型 import、常量 import 和 `selectFiles` 方法。

完成条件：renderer 能通过 `electronAPI.selectFiles()` 拿到类型正确的选择结果；取消选择有稳定空结果。

### Slice 2: Sender 受控插入 API

1. 扩展 `Sender.vue` 的 `defineEmits`，新增 `select-files`。
2. 新增内部函数 `insertFiles(files: SenderFileOption[])`：
   - 对每个文件以 `path` 去重。
   - 未重复文件调用 `Editor.insertFileTag()`。
   - 插入后调用 `syncFileKeysFromEditor()`。
   - 保持或恢复编辑器焦点。
3. 让现有 `handleFileSelect(file)` 复用 `insertFiles([file])`，但继续清理 trigger 文本并关闭面板。
4. 新增 `handleSystemFileSelect()`，点击 `+` 时发出 `select-files`，并传入 `insertFiles` 回调。
5. 不在 sender 中导入 Electron、`app/work`、Pinia 或 Vue Router。

完成条件：sender 可以在宿主传入 `SenderFileOption[]` 后插入与 `@` 文件选择一致的文件标签。

### Slice 3: Sender 工具栏交互与可访问性

1. 将工具栏第一个 `PlusIcon` 按钮改为系统文件添加入口，点击调用 `handleSystemFileSelect()`。
2. 技能手动入口换成 `WandSparklesIcon` 或 `BlocksIcon`，点击仍调用 `triggerManager.toggleManualPanel(SKILL_TRIGGER)`。
3. 保留工作区文件入口 `FileTextIcon`，点击仍调用 `triggerManager.toggleManualPanel(FILE_TRIGGER)`。
4. 为三个纯图标按钮提供清晰 `sr-only` 文案，必要时套用现有 `Tooltip` 组件，文案保持短句。
5. 确认点击 `+` 不打开 `FilePickerPanel`，只有 `@` 或工作区文件入口才打开工作区文件面板。

完成条件：三个工具栏动作在视觉和行为上可区分，且 `+` 明确触发系统选择器。

### Slice 4: app/work 宿主映射

1. 在 `SenderContainer.vue` 添加 `handleSelectFiles(insertFiles)`。
2. 调用 `electronAPI.selectFiles({ multiSelections: true, defaultPath })`；`defaultPath` 优先使用当前 workspace root，缺失时不传。
3. 用户取消时直接返回，不改草稿、不调用插入函数。
4. 将 `SelectedSystemFile[]` 转为 `SenderFileOption[]`：
   - `name` 取系统返回名。
   - `path` 保留完整路径。
   - `extension` 使用系统返回后缀，缺失时从文件名推导。
   - `size` 透传。
   - `relativePath`：工作空间内文件使用现有 `getRelativePath()`；工作空间外文件使用 `name`。
5. 在模板上监听 `@select-files="handleSelectFiles"`。
6. 捕获选择失败错误，以不清空草稿为底线；如已有 toast/sonner 模式可复用，否则先用局部 `console.error` 保持实现克制。

完成条件：`app/work` 能把系统选择文件交回 sender 插入，并且不改变现有发送链路。

### Slice 5: 回归与验证

1. 手动验证点击 `+` 打开系统文件选择器，而不是工作区文件面板。
2. 手动验证取消选择后草稿不变。
3. 手动验证选择单个文件和多个文件后插入文件标签。
4. 手动验证重复选择同一路径文件不会插入重复标签。
5. 手动验证系统选择文件和 `@` 添加文件的标签视觉一致。
6. 手动验证发送 payload 包含系统选择文件的 `selectedFiles`，`message` 包含 `[文件名](文件路径)`。
7. 回归验证 `/` 技能选择、`@` 工作区文件选择、模型选择、联网开关、发送/停止按钮。
8. 运行 `pnpm lint`。
9. 因修改共享包、IPC 类型和 app 入口，运行 `pnpm build`。

## File Touch List

- `app/work/src/shared/constants.ts`
- `app/work/src/shared/api.ts`
- `app/work/src/shared/hook/dialog.hook.ts`
- `app/work/src/main/controllers/dialog.controller.ts`
- `app/work/src/preload/preload.ts`
- `packages/sender/src/components/Sender.vue`
- `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue`

可选但需谨慎：

- `app/ui-playground/src/demos/scenes/SenderDemo.vue`：如果实现时需要无 Electron 环境验证受控插入事件，可加一个 mock 入口；不是本 OpenSpec 必需项。

## Assumptions

- 系统文件选择器支持多选，目录选择不在本次范围。
- 系统选择文件可以来自工作空间外；`path` 是结构化识别依据，`relativePath` 对外部文件只承担展示用途。
- 当前“只有文件标签但没有正文不可发送”的行为不在本次改变范围内。
- 发送链路已支持 `selectedFiles`，本次只需让系统选择文件进入现有 `FileTag` 和 `selectedFiles` 机制。
- `DialogController` 已由 `AppModule` 注册，因此新增同一 controller 方法不需要新增 controller 注册。

## Stop Conditions

- 如果 Electron 选择文件无法提供完整本地路径，停止并回到 `workflow-spec`，因为这会破坏 `selectedFiles.path` 语义。
- 如果 sender 需要直接依赖 Electron 或 `app/work` 才能完成插入，停止并回到设计调整。
- 如果实现需要改变“只选文件也可发送”的发送规则，停止并回到 `workflow-spec`。
- 如果新增 `+` 后必须移除现有 `@` 或 `/` 交互才能工作，停止并修正方案，不继续实现。

## Verification Commands

```bash
pnpm lint
pnpm build
```

手动验证需要运行桌面应用：

```bash
pnpm dev
```
