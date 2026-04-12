import { markRaw } from "vue";
import ConversationDemo from "./scenes/ConversationDemo.vue";
import EdgeStatesDemo from "./scenes/EdgeStatesDemo.vue";
import MarkdownDemo from "./scenes/MarkdownDemo.vue";
import StreamingDemo from "./scenes/StreamingDemo.vue";
import ToolingDemo from "./scenes/ToolingDemo.vue";
import type { DemoDefinition } from "./types";

export const demoRegistry: DemoDefinition[] = [
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
    id: "tooling",
    title: "工具渲染",
    description: "检查工具摘要、展开面板、成功与失败结果的视觉反馈。",
    group: "工具状态",
    component: markRaw(ToolingDemo),
  },
  {
    id: "edge-states",
    title: "边界状态",
    description: "检查长内容、错误态和密集文本容器下的稳定性。",
    group: "边界状态",
    component: markRaw(EdgeStatesDemo),
  },
];
