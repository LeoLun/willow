# 资源选择面板支持 Tab 键确认选择
   
## 动机
   
当前在输入框中输入 `/` 呼出资源（命令、技能、工作空间 Agent、文件等）选择面板时，用户可以使用 `ArrowUp` 和 `ArrowDown` 键在面板选项中进行上下移动，并通过 `Enter` 键确认选择。然而，在许多代码提示和自动补全场景下，使用 `Tab` 键确认当前高亮的选项也是非常符合直觉的高频操作。目前按下 `Tab` 键只会导致浏览器焦点的转移，从而关闭或破坏了面板交互。
   
## 目标
   
1. 在资源选择面板打开且有高亮选项时，支持按 `Tab` 键直接确认选中当前高亮的选项，并阻止默认的焦点切换行为。
   
## 范围
   
- 涉及 `packages/sender/src/components/Sender.vue` 中的键盘按键事件拦截处理（`handleEditorKeyDown` 函数）。
- 当资源选择面板可见 (`triggerManager.isAnyPanelVisible.value`) 时，拦截 `Tab` 按键事件。
- 执行与 `Enter` 相同的选择逻辑（调用 `handleResourceSelect` 选中当前高亮的项），并调用 `event.preventDefault()`。
   
## 非范围
   
- 不更改 Tab 键在资源选择面板关闭时的默认行为（即正常的表单焦点轮转）。
- 不更改 Tab 键在其他页面的配置/输入逻辑。
