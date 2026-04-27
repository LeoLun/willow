# Design: split-settings-page

## Overview

本次变更将设置页从单一内容流改造成独立设置工作区。设置入口仍来自主应用导航或其他业务入口，但一旦进入设置路由，主应用左侧导航必须退出画面。设置工作区自身只包含两栏：

- 左侧：设置专属侧边栏，包含“返回应用”“外观”“配置”。
- 右侧：当前设置分区内容。

参考设计稿：

- [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) `Willow / Settings / Appearance`
- [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) `Willow / Settings`

实现必须遵守 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md)：保持桌面工作台气质、紧凑信息密度、稳定设置分组、克制边框与表面层级，并优先使用 `@willow/shadcn` / `@willow/ui` 与 `lucide-vue-next`。

## Chosen Approach

采用“独立设置壳层 + 子路由”的结构：

- `/setting`：设置入口，默认重定向到外观页。
- `/setting/appearance`：外观设置页。
- `/setting/configuration`：配置设置页。

设置壳层负责：

- 在主应用侧边栏之外渲染设置页面，或通过等价机制让设置路由隐藏主应用侧边栏。
- 左侧设置二级导航。
- “返回应用”入口。
- 右侧内容容器的尺寸、留白和滚动边界。
- 当前分区的选中态。

子页面负责：

- 自己的标题、说明、设置分组和业务交互。
- 只加载自己所需的数据，避免进入外观页时额外拉取模型和 Tavily Key。

## Layout Model

### Settings Workspace

设置工作区应占据主内容区域，形成类似参考设计稿的两栏结构：

- 左侧设置导航宽度稳定，约 240-280px。
- 右侧内容区使用受控宽度，桌面端可参考设计稿的 760px 内容宽度。
- 整体背景使用现有 `background` / `card` / `sidebar` token，不引入新主题层。
- 页面不使用营销 Hero、渐变背景或装饰性大图。
- 设置路由不显示主应用左侧导航、主应用 `SidebarTrigger` 或工作空间列表；不能出现“主应用侧边栏 + 设置侧边栏 + 内容区”的三栏布局。

设置页内部不应再把“设置”作为唯一大标题后堆叠所有配置。每个子页面拥有自己的标题：

- `外观`
- `配置`

### Settings Sidebar

设置侧边栏包含：

1. 顶部或靠上位置的“返回应用”入口。
2. 设置导航项“外观”。
3. 设置导航项“配置”。

交互规则：

- “返回应用”应使用 `arrow-left` 类图标和文本。
- “外观”应使用 `sun` 或同等语义图标。
- “配置”应使用 `settings-2` 或同等语义图标。
- 当前导航项使用浅色选中表面与较强字重，但不要使用高饱和彩色强调。
- 导航点击应通过路由跳转，而不是仅更新局部状态。
- 设置侧边栏是设置页内唯一左侧导航。它不是主应用左侧栏右边追加的一层面板。

“返回应用”的目标建议：

- 如果进入设置页前有可恢复的主应用路径，优先返回该路径。
- 如果没有可恢复路径，回到 `/`。

实现阶段可以选择用路由 query、history state 或简单 `router.back()` + fallback 达成，但行为必须对用户稳定。

### Appearance Page

外观页包含：

- 页面标题：`外观`
- 设置分组标题：`外观`
- 分组说明：`自定义应用的显示主题`
- 字段：`主题模式`
- 字段说明：`选择浅色、深色或跟随系统`
- 控件：单选 ToggleGroup，包含 `跟随系统`、`浅色`、`深色`

行为约束：

- 必须复用现有 `useDarkMode()` 与 `ThemeMode` 语义。
- 当前主题选中态必须清晰可见。
- 切换主题后立即生效，行为与现有设置页一致。
- 进入外观页不应触发模型列表或 Tavily Key 列表加载。

### Configuration Page

配置页包含两个设置分组：

1. `模型配置`
2. `网络搜索 (Tavily)`

模型配置分组：

- 标题：`模型配置`
- 说明：`管理可用的 AI 模型`
- 主操作：`添加模型`
- 列表项展示模型名称、默认标记、提供方、模型 ID、Base URL。
- 行内操作保留设为默认、编辑、删除，并继续使用 Tooltip 和 lucide 图标按钮。
- 空状态保留明确文案与新增入口。

Tavily 分组：

- 标题：`网络搜索 (Tavily)`
- 说明：`管理 Tavily API Key，用于网络搜索功能`
- 主操作：`添加 Key`
- 列表项展示脱敏 Key、用量和进度条。
- 行内操作保留编辑、删除，并继续使用 Tooltip 和 lucide 图标按钮。
- 空状态保留明确文案与新增入口。

行为约束：

- 必须复用现有 `useConfigStore()` 能力和现有弹窗组件。
- 默认模型设置、模型增删改、Tavily Key 增删改的业务语义不能变化。
- 配置页进入时加载模型列表和 Tavily Key 列表；外观页不负责这些请求。

## Route And Entry Rules

### Route Rules

建议路由结构：

- `/setting` 重定向到 `/setting/appearance`
- `/setting/appearance` 命名为 `settingAppearance`
- `/setting/configuration` 命名为 `settingConfiguration`

壳层集成规则：

- 设置路由可以继续在同一个 Vue Router 中定义，但渲染时必须绕过或隐藏主应用 `LeftSidebar`。
- 可采用路由 `meta`、顶层布局分支、独立设置 layout 或其他等价方式实现。
- 不允许只在主应用内容区内部渲染设置壳层，否则会保留主应用侧边栏并偏离 `work.pen`。

现有入口调整：

- 主侧边栏“设置”进入 `/setting/appearance` 或 `/setting` 后由路由重定向。
- 发送器中“前往设置”更适合进入 `/setting/configuration`，因为它通常由“未配置模型”触发。
- 其他泛化设置入口可进入 `/setting/appearance`。

### Back To App

“返回应用”不是浏览器后退按钮的纯复制。它应承担“离开设置工作区，回到主应用”的明确语义。

最低要求：

- 用户从设置页点击“返回应用”后，不应留在设置路由。
- 无可恢复来源时回到 `/`。
- 返回行为不应破坏聊天输入、自动化详情或其他页面的已有状态。

## Component And State Boundaries

推荐拆分：

- `pages/setting/Setting.vue`：设置壳层。
- `pages/setting/appearance/AppearanceSetting.vue`：外观子页面。
- `pages/setting/configuration/ConfigurationSetting.vue`：配置子页面。
- 顶层应用壳层或布局组件需要根据设置路由选择是否渲染主应用侧边栏。

也可以使用同等清晰的命名，但必须保持以下边界：

- 壳层不直接持有模型和 Tavily Key 管理逻辑。
- 外观页不依赖配置页数据。
- 配置页不重复实现主题切换。
- 弹窗组件继续由现有 dialog provider 承载。
- 主应用侧边栏的导航、工作空间列表和触发按钮不应参与设置页画面。

## Visual Constraints

对照 `DESIGN.md`，实现应满足：

- 设置分组使用轻边框、稳定圆角和紧凑 `p-4` / `gap-3` / `gap-4` 节奏。
- 页面标题使用工作台级别标题，不使用超大字号。
- 每个分组只承载一个主题，危险操作与普通操作保持区分。
- 图标按钮必须使用 lucide 图标，并为不明显操作提供 Tooltip。
- 不创建新的颜色 token，不使用渐变、重阴影或装饰性背景。

## Loading, Empty, And Error States

- 外观页无需额外加载态，除非现有主题读取机制需要。
- 配置页在列表数据加载期间应保持受控状态，不出现空白闪烁。
- 模型为空时说明“暂无配置的模型”，并提供添加模型入口。
- Tavily Key 为空时说明“暂无配置的 Tavily API Key”，并提供添加 Key 入口。
- 请求失败时使用现有 store / toast / 局部错误语义，不静默失败。

## Resolved Decisions

### 是否保留单页设置

不保留。外观与配置必须成为设置工作区中的两个独立页面。

### 设置页是否保留主应用侧边栏

不保留。进入设置页后主应用侧边栏必须隐藏或被设置专属侧边栏替代。设置页画面应与 `work.pen` 一致，只包含设置侧边栏和设置内容区。

### 是否新增更多设置分类

不新增。本次侧边栏只包含“外观”和“配置”两项。

### `/setting` 默认进入哪里

默认进入“外观”。这与参考设计稿中 `Willow / Settings / Appearance` 的基础设置入口一致，也更适合作为泛化设置首页。

### “前往设置”是否进入外观页

由模型缺失或发送器配置触发的“前往设置”应进入“配置”页。泛化设置入口进入“外观”页。
