# split-settings-page 执行计划

## 变更来源

- OpenSpec change: [`split-settings-page`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/split-settings-page/proposal.md)
- 规格文件: [`settings-page/spec.md`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/split-settings-page/specs/settings-page/spec.md)
- 设计决策: [`design.md`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/split-settings-page/design.md)
- 任务清单: [`tasks.md`](/Users/liujinglun/code/willow/docs/ai-workflows/openspec/changes/split-settings-page/tasks.md)
- 设计参考: [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) 中 `Willow / Settings / Appearance` 与 `Willow / Settings`
- 长期设计规范: [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md)

## 当前实现基线

- 当前设置页已经拆为 [`Setting.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/setting/Setting.vue) 壳层、[`AppearanceSetting.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/setting/appearance/AppearanceSetting.vue) 和 [`ConfigurationSetting.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue)。
- 当前设置路由已经是 `/setting` 壳层 + `/setting/appearance`、`/setting/configuration` 子路由。
- 主侧边栏 [`LeftSidebar.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/layout/sidebar/LeftSidebar.vue) 可进入 `/setting`，聊天发送器容器 [`SenderContainer.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/components/SenderContainer.vue) 可进入 `/setting/configuration`。
- 当前问题是 [`App.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/App.vue) 顶层始终渲染 `SidebarProvider`、`LeftSidebar` 和 `SidebarTrigger`，导致 `/setting*` 路由画面变成“主应用侧边栏 + 设置侧边栏 + 内容区”的三栏结构。
- 本次纠偏后的目标是：`/setting*` 路由仍保留设置壳层和子页面，但必须在主应用侧边栏之外渲染，符合 `work.pen` 的两栏设置页。

## 假设与约束

- 本计划只覆盖 OpenSpec 已定义的“外观 / 配置”两项，不新增其他设置分类。
- 不改后端 API、不改模型或 Tavily Key 数据结构、不重构 store。
- 继续使用 Vue 3 `<script setup lang="ts">`、Composition API、`@willow/shadcn` 和 `lucide-vue-next`。
- 参考设计稿用于结构、密度、分组和导航语义，不逐像素复刻。
- 设置页必须是独立两栏页面；主应用 `LeftSidebar`、`SidebarTrigger`、工作空间列表不参与设置页画面。
- 可用 Vue Router `meta`、路径判断或等价方式在顶层应用壳层区分设置布局；不要重写主应用侧边栏内容。
- 当前工作区存在与本变更无关的 `ui/work.pen` 和 `remove-automation-running-gate/tasks.md` 修改，实施时不要回退或覆盖。

## 执行切片

### 1. 建立设置路由骨架

目标：先让 URL 和页面层级符合 OpenSpec，暂不迁移全部业务内容。

步骤：

1. 在 [`router.ts`](/Users/liujinglun/code/willow/app/work/src/renderer/src/router.ts) 中将 `/setting` 改为壳层路由。
2. 新增子路由：
   - `/setting/appearance`，name 建议为 `settingAppearance`
   - `/setting/configuration`，name 建议为 `settingConfiguration`
3. 让 `/setting` redirect 到 `/setting/appearance`。
4. 保留既有根路由守卫逻辑，确认不会影响设置子路由直接访问。

验证：

- 代码阅读确认 `/setting` 不再直接渲染旧单页内容。
- 直接访问三个路径时的预期分别为重定向、外观页、配置页。

停机条件：

- 如果 Vue Router 当前嵌套路由结构与设置壳层冲突，先停止并回到 OpenSpec 明确是否允许采用等价路由结构。

### 2. 实现设置壳层与二级导航

目标：实现独立设置工作区的左侧导航和右侧内容容器。

步骤：

1. 将 [`pages/setting/Setting.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/setting/Setting.vue) 改造成设置壳层。
2. 壳层只负责：
   - 两栏布局
   - “返回应用”入口
   - “外观 / 配置”导航项
   - 当前选中态
   - `<RouterView />` 内容出口
3. 使用 `ArrowLeft`、`Sun`、`Settings2` 等 lucide 图标。
4. 选中态基于当前路由 name 或 path 计算，通过 `router.push()` 切换。
5. “返回应用”优先使用可恢复来源；若实现中无法可靠捕获来源，则至少稳定 fallback 到 `/`，并在代码中保持逻辑简单可读。
6. 布局对齐设计稿：左侧导航约 `w-64`，右侧内容区滚动，内部内容宽度约 `max-w-[760px]`。

验证：

- 设置侧边栏只出现“返回应用”“外观”“配置”。
- 当前分区选中态跟随路由变化。
- “返回应用”不会停留在 `/setting*` 路由。

停机条件：

- 如果“返回应用”的来源恢复需要引入全局导航状态或较大路由改造，先实现 fallback 到 `/`，并记录为后续优化，不扩大本次范围。

### 3. 拆出外观设置页

目标：让外观页独立承载主题模式设置，并避免加载配置数据。

步骤：

1. 新建 [`pages/setting/appearance/AppearanceSetting.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/setting/appearance/AppearanceSetting.vue)。
2. 从旧 `Setting.vue` 移入主题模式相关逻辑：
   - `useDarkMode()`
   - `ThemeMode`
   - `themeModes`
   - `onThemeChange`
3. 保持 ToggleGroup 三项：`跟随系统`、`浅色`、`深色`。
4. 页面结构：
   - 页面标题 `外观`
   - 分组标题 `外观`
   - 分组说明 `自定义应用的显示主题`
   - 字段标题 `主题模式`
   - 字段说明 `选择浅色、深色或跟随系统`
5. 确认该文件不引入 `useConfigStore()`、模型类型或 Tavily 类型。

验证：

- 外观页主题切换即时生效。
- 进入外观页不会调用 `fetchModelList()` 或 `fetchTavilyKeyList()`。
- 页面分组和控件密度符合 `DESIGN.md`。

停机条件：

- 如果主题持久化在拆出后失效，先修复为与原 `Setting.vue` 行为一致，不新增新的主题存储机制。

### 4. 拆出配置设置页

目标：把模型配置和 Tavily Key 管理迁移到配置页，保持业务交互不变。

步骤：

1. 新建 [`pages/setting/configuration/ConfigurationSetting.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/setting/configuration/ConfigurationSetting.vue)。
2. 从旧 `Setting.vue` 移入配置相关逻辑：
   - `useConfigStore()`
   - `storeToRefs`
   - `onBeforeMount()` 加载 `fetchModelList()` 与 `fetchTavilyKeyList()`
   - 模型新增、编辑、删除、设默认
   - Tavily Key 新增、编辑、删除、脱敏
3. 保留现有 dialog 组件：
   - `ModelForm`
   - `DeleteModel`
   - `TavilyKeyForm`
   - `DeleteTavilyKey`
4. 页面结构：
   - 页面标题 `配置`
   - 分组一：`模型配置`
   - 分组二：`网络搜索 (Tavily)`
5. 列表项继续展示现有字段：模型名称、默认 Badge、provider、modelId、baseUrl；Key 脱敏、usage、monthlyLimit、Progress。
6. 保持行内操作为 lucide 图标按钮，继续包裹 Tooltip。
7. 空状态保留明确文案，并确保主操作按钮仍可用。

验证：

- 配置页进入时加载模型和 Tavily Key。
- 添加、编辑、删除、设默认入口仍打开原有弹窗。
- 空列表状态可读且不影响新增入口。
- 配置页不包含主题切换逻辑。

停机条件：

- 如果拆分导致 dialog provider 注入不可用，先确认壳层仍在当前 `App.vue` 的 `DialogProvider` 范围内；不要把弹窗系统搬进设置页。

### 5. 更新入口语义

目标：让不同入口进入符合语义的设置分区。

步骤：

1. 在 [`LeftSidebar.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/layout/sidebar/LeftSidebar.vue) 中，将泛化“设置”入口指向 `/setting` 或 `/setting/appearance`。
2. 在 [`SenderContainer.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/components/SenderContainer.vue) 中，将 `handleOpenSettings()` 指向 `/setting/configuration`。
3. 搜索所有 `router.push("/setting")`、`to="/setting"`、`name: "setting"` 等入口，按 OpenSpec 语义更新。
4. 如外部包 `@willow/sender` 仅发出 `open-settings` 事件，不改包内部行为。

验证：

- 主侧边栏进入外观默认页。
- 发送器“前往设置”进入配置页。
- 没有遗留指向已删除路由 name 的调用。

停机条件：

- 如果发现某入口语义无法判断，默认保留泛化入口到 `/setting`，依赖重定向进入外观页。

### 6. 设计自检与整理

目标：避免拆分完成后出现视觉或职责回退。

步骤：

1. 对照 `DESIGN.md` 检查：
   - 页面不出现 Hero 或营销式大标题。
   - 设置分组用轻边框、稳定圆角、紧凑间距。
   - 只使用现有 token 和 shadcn / lucide。
   - 图标按钮有 Tooltip。
2. 对照 `ui/work.pen` 检查：
   - 左侧设置导航结构一致。
   - 外观与配置页内容顺序一致。
   - 右侧内容宽度和留白接近参考。
3. 删除旧 `Setting.vue` 中不再使用的 import 和逻辑。
4. 确认外观页、配置页、壳层之间没有重复职责。

验证：

- `rg "fetchModelList|fetchTavilyKeyList" app/work/src/renderer/src/pages/setting` 只应在配置页命中。
- `rg "useDarkMode" app/work/src/renderer/src/pages/setting` 只应在外观页命中，除非壳层确有必要。
- `rg "\"/setting\"" app/work/src/renderer/src` 的结果符合入口语义。

### 7. 纠偏设置页独立壳层

目标：修复当前三栏布局，让 `/setting*` 路由严格按 `work.pen` 呈现为“设置侧边栏 + 设置内容区”两栏。

步骤：

1. 在 [`router.ts`](/Users/liujinglun/code/willow/app/work/src/renderer/src/router.ts) 中为 `/setting` 路由增加清晰的布局信号，建议使用 `meta: { layout: "settings" }` 或等价命名。
2. 在 [`App.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/App.vue) 中读取当前路由，新增 `isSettingsLayout` 计算值。
3. 当 `isSettingsLayout` 为 true 时：
   - 不渲染 `SidebarProvider`
   - 不渲染 `LeftSidebar`
   - 不渲染主应用 `SidebarTrigger`
   - 使用一个全屏、无主应用侧边栏的容器直接承载 `<RouterView />`
4. 当 `isSettingsLayout` 为 false 时，保留现有主应用布局，不改变聊天、自动化、技能、工作空间历史等普通路由的侧边栏行为。
5. 保持 `DialogProvider` 和 `Toaster` 在两个布局分支外层继续可用，避免模型、Tavily Key 弹窗或 toast 行为被设置页布局分支破坏。
6. 确认设置壳层 [`Setting.vue`](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/setting/Setting.vue) 自己仍负责“返回应用”“外观”“配置”和子页面内容出口，不把设置导航搬回 `App.vue`。

验证：

- 代码搜索确认 `/setting*` 路由下 `LeftSidebar` 和主应用 `SidebarTrigger` 不会渲染。
- 在设置路由下，画面只应由 `Setting.vue` 的设置侧边栏和子页面内容组成。
- 普通路由仍通过 `SidebarProvider + LeftSidebar + Card + RouterView` 渲染。

停机条件：

- 如果 `SidebarProvider` 内部状态是普通路由正常显示所必需，不要把整个应用布局重写；只给设置路由建立最小分支。
- 如果设置页弹窗失效，先确认 `DialogProvider` 是否仍在布局分支外层；不要复制 dialog provider 到子页面。

## 最终验证

命令验证：

1. 运行 `pnpm lint`。
2. 如果路由拆分或 Vue SFC 改动导致类型 / 构建风险较高，再运行 `pnpm build`。

手动验证：

1. 直接访问 `/setting`，确认进入外观页。
2. 直接访问 `/setting/appearance`，确认外观页显示且导航选中。
3. 直接访问 `/setting/configuration`，确认配置页显示且导航选中。
4. 在任一设置路由下确认不显示主应用侧边栏、主应用侧边栏触发按钮或工作空间列表，只显示设置侧边栏和内容区。
5. 从主侧边栏点击“设置”，确认进入外观默认页，并且进入后主侧边栏消失。
6. 从发送器模型缺失或“前往设置”入口进入，确认进入配置页，并且进入后主侧边栏消失。
7. 在外观页切换三种主题模式，确认即时生效。
8. 在配置页打开添加模型、编辑模型、删除模型、设默认、添加 Key、编辑 Key、删除 Key 入口。
9. 点击“返回应用”，确认离开设置工作区；有来源时回来源，无来源时回到 `/`。

## 完成标准

- OpenSpec `tasks.md` 中 1-6 节对应事项均可标记完成。
- 设置页拆分后没有新增业务能力，也没有移除原有设置能力。
- 入口语义与 OpenSpec 一致：泛化设置进入外观，模型配置相关入口进入配置。
- 设置页布局与 `work.pen` 一致，不显示主应用侧边栏，不出现三栏结构。
- 最终验证结果记录在实现回复或后续 `workflow-close` 中。
