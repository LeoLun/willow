# Proposal: add-sender-file-mention

## Background

Willow 的聊天发送器已经抽离为共享包 `@willow/sender`，并支持通过 `/` 触发技能选择。用户现在需要在同一个输入器中通过 `@` 触发文件选择，将工作空间文件作为上下文引用加入消息，实现体验参考现有 `/` 操作。

当前相关基础已经存在：

- `@willow/sender` 内有 `useTriggerManager`，可按触发字符识别查询、控制面板显示、键盘上下选择与关闭。
- `Sender.vue` 已把 `/` 注册为技能触发器，并通过 `SkillPickerPanel` 完成搜索、选中和标签插入。
- `app/work` 已有 `useWorkspaceFiles()` 与 `electronAPI.getWorkspaceFiles()`，可以读取当前工作空间文件树。
- `ChatRightSidebar` 已展示工作空间文件，证明文件数据模型与 UI 图标体系已有基础。

## Goals

- 在发送器输入区支持输入 `@` 后搜索并选择当前工作空间文件。
- 文件选择交互复用 `/` 操作的触发、面板、键盘导航和插入标签模式。
- 文件引用插入到消息文本时使用 Markdown 链接格式：`[文件名.后缀](文件地址)`，例如 `[app.ts](/user/xxxx/app.ts)`。
- `@willow/ui` 消息渲染需要识别该文件引用格式，并参考现有技能引用 `[$skillname](skill/xxx.md)` 的渲染方式显示为紧凑标签，而不是普通外链。
- 发送 payload 中包含用户选择的文件引用，供宿主消息链路作为上下文传递。
- 保持 `@willow/sender` 的共享包边界：包内只处理 UI、交互和宿主无关类型，文件数据由宿主传入。
- 视觉与交互符合 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 的桌面工作台输入器标准，保持紧凑、稳定、工具型。

## Non-Goals

- 本次不实现文件内容读取、上传、向模型注入文件内容或后端工具调用。
- 本次不改造工作空间文件扫描规则、忽略规则或文件树读取性能策略。
- 本次不支持选择文件夹作为引用，除非后续 OpenSpec 明确要求。
- 本次不新增独立的全局文件管理页面。
- 本次不改变 `/` 技能选择现有语义。

## User Experience

用户在聊天输入器中输入 `@` 后，发送器在输入框上方打开文件选择面板。用户可以继续输入文件名或路径片段过滤结果，使用鼠标点击或键盘上下键加 Enter 选择文件。选中文件后，触发文本被替换为一个文件引用标签，输入器继续聚焦。该标签在消息文本中的格式为 `[文件名.后缀](文件地址)`，处理方式参考现有技能标签 `[$skillname](skill/xxx.md)`。

消息展示时，`@willow/ui` 的 Markdown 渲染器应像渲染技能标签一样，把 `[app.ts](/user/xxxx/app.ts)` 渲染为文件引用标签，显示文件名并保留路径信息；普通 Markdown 链接仍保持原有外链渲染。

用户点击底部工具栏中的文件入口时，也可以手动打开文件选择面板；该模式展示当前工作空间文件列表或扁平化的可选文件。发送消息后，文件引用随本次消息 payload 一起发送，并清空当前草稿中的文件标签。

## Approaches

### Approach A: 在 `app/work` 本地包一层独立文件选择器

在 `SenderContainer.vue` 外围监听输入内容或额外叠加一个文件选择弹层，选中后再把文本写回发送器。

优点：

- 可以快速接入 `useWorkspaceFiles()`。
- 不需要改动 `@willow/sender` 公共 API 太多。

缺点：

- 输入器内部编辑器、触发范围、键盘导航和标签插入都在 `@willow/sender` 内，外围实现容易和现有 `/` 行为重复或冲突。
- 共享包无法在 `app/ui-playground` 中展示完整文件引用能力。
- 后续其他宿主复用时需要重复实现同一套交互。

### Approach B: 在 `@willow/sender` 中抽象“引用选择”能力，由宿主传入文件数据

在共享包内复用 `useTriggerManager`，新增 `@` 触发器、文件选择面板、文件引用标签和 `SenderFileReference` 类型。`app/work` 宿主容器负责读取当前工作空间文件并传入扁平化或树形文件选项。

优点：

- 最贴近现有 `/` 交互实现，键盘行为、面板定位、触发文本清理和标签插入保持一致。
- 继续保持共享包不直接依赖 Electron IPC、Pinia 或 `app/work` 类型。
- 文件引用能力可以在 `app/work` 与 `app/ui-playground` 中用同一个组件验证。

缺点：

- 需要扩展 `@willow/sender` 的公共类型与 send payload。
- 需要在包内增加第二类 inline tag，并处理技能标签与文件标签并存。

### Approach C: 仅将 `@路径` 作为纯文本约定，不做选择器

输入器保留普通文本，用户手动输入 `@src/foo.ts`，发送链路后续再解析文本中的文件路径。

优点：

- 实现成本最低。
- 不需要新增 UI 面板或包 API。

缺点：

- 无法满足“实现参考 `/` 操作”的选择体验。
- 路径容易输错，缺少可发现性和键盘选择。
- 发送 payload 缺少结构化文件引用，后续上下文注入会更脆弱。

## Recommendation

推荐 Approach B。

原因是该需求本质上是发送器内部的触发选择能力扩展，而不是宿主外围能力。文件数据源归宿主，触发、面板、标签和 payload 归共享包，正好延续 `extract-chat-sender-package` 的边界设计。

## Success Criteria

- 在聊天输入器输入 `@` 可打开文件选择面板，并按查询过滤当前工作空间文件。
- 文件面板支持鼠标选择、ArrowUp / ArrowDown、Enter、Escape，行为与 `/` 技能选择一致。
- 选中文件后输入器插入文件引用标签，标签可和普通文本、技能标签共存。
- 文件引用在 `message` 文本中以 `[文件名.后缀](文件地址)` 输出，例如 `[app.ts](/user/xxxx/app.ts)`，并与技能引用 `[$skillname](skill/xxx.md)` 的标签渲染/提取机制保持一致。
- `@willow/ui` 能在用户消息和助手消息的 Markdown 渲染中把文件引用显示为文件标签，且不影响普通链接和技能标签。
- 发送事件 payload 包含结构化 `selectedFiles`，至少包括文件名、绝对路径、工作空间相对路径和扩展名。
- `@willow/sender` 不直接导入 `app/work` 源码、`@/`、Electron IPC、Pinia 或 Vue Router。
- 无工作空间或文件加载失败时，输入器给出克制的空态或错误态，不影响普通文本发送。
