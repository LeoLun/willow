import { markRaw } from "vue";
import AllToolsOverviewDemo from "./scenes/AllToolsOverviewDemo.vue";
import AutomationToolDemo from "./scenes/AutomationToolDemo.vue";
import BashToolDemo from "./scenes/BashToolDemo.vue";
import ConversationDemo from "./scenes/ConversationDemo.vue";
import CoreToolDemo from "./scenes/CoreToolDemo.vue";
import DefaultToolDemo from "./scenes/DefaultToolDemo.vue";
import EdgeStatesDemo from "./scenes/EdgeStatesDemo.vue";
import MarkdownDemo from "./scenes/MarkdownDemo.vue";
import SenderDemo from "./scenes/SenderDemo.vue";
import StreamingDemo from "./scenes/StreamingDemo.vue";
import TodoToolDemo from "./scenes/TodoToolDemo.vue";
import WebFetchToolDemo from "./scenes/WebFetchToolDemo.vue";
import WebSearchToolDemo from "./scenes/WebSearchToolDemo.vue";
import WelcomeHomeDemo from "./scenes/WelcomeHomeDemo.vue";
import type { DemoDefinition } from "./types";

export const demoRegistry: DemoDefinition[] = [
  {
    id: "sender",
    title: "Sender 输入器",
    description: "直接验证 @willow/sender 的模型切换、技能选择、slash 搜索和发送事件。",
    group: "输入器",
    component: markRaw(SenderDemo),
  },
  {
    id: "welcome-home",
    title: "欢迎首页",
    description: "模拟空会话数据状态下的欢迎首页展示及建议 Prompt 点击交互机制。",
    group: "页面场景",
    component: markRaw(WelcomeHomeDemo),
  },
  {
    id: "conversation",
    title: "消息列表",
    description: "检查用户消息、助手消息、工具结果与 usage 行的整体层级。",
    group: "消息流",
    component: markRaw(ConversationDemo),
  },
  {
    id: "streaming",
    title: "流式输出",
    description: "检查思考块、pending tool call 和流式指示器的状态表现。",
    group: "消息流",
    component: markRaw(StreamingDemo),
  },
  {
    id: "markdown",
    title: "Markdown 内容块",
    description: "检查标题、列表、表格、代码块与数学公式的排版细节。",
    group: "内容块",
    component: markRaw(MarkdownDemo),
  },
  {
    id: "tools-overview",
    title: "全部工具总览",
    description: "把当前所有工具调用 demo 聚合到一个页面里统一检查。",
    group: "工具状态",
    component: markRaw(AllToolsOverviewDemo),
  },
  {
    id: "tool-bash",
    title: "Bash",
    description: "覆盖 bash 工具调用的成功态和失败态。",
    group: "工具状态",
    component: markRaw(BashToolDemo),
  },
  {
    id: "tool-websearch",
    title: "Web Search",
    description: "覆盖搜索结果摘要、链接 pill 和展开结果区。",
    group: "工具状态",
    component: markRaw(WebSearchToolDemo),
  },
  {
    id: "tool-webfetch",
    title: "Web Fetch",
    description: "覆盖网页抓取摘要、参数和抓取结果预览。",
    group: "工具状态",
    component: markRaw(WebFetchToolDemo),
  },
  {
    id: "tool-todo",
    title: "Todo",
    description: "覆盖 todoread 与 todowrite 的状态统计和列表展示。",
    group: "工具状态",
    component: markRaw(TodoToolDemo),
  },
  {
    id: "tool-automation",
    title: "Automation Create",
    description: "覆盖自动化创建结果卡片和计划文案展示。",
    group: "工具状态",
    component: markRaw(AutomationToolDemo),
  },
  {
    id: "tool-core",
    title: "Core Renderer",
    description: "覆盖 core 通用工具渲染和 JSON 详情展开。",
    group: "工具状态",
    component: markRaw(CoreToolDemo),
  },
  {
    id: "tool-default",
    title: "Default Fallback",
    description: "覆盖没有专用 renderer 时的默认回退样式。",
    group: "工具状态",
    component: markRaw(DefaultToolDemo),
  },
  {
    id: "edge-states",
    title: "边界状态",
    description: "检查长内容、错误态和密集文本容器下的稳定性。",
    group: "边界状态",
    component: markRaw(EdgeStatesDemo),
  },
];
