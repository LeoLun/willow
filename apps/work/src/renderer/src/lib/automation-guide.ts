import type { ComposerPromptTemplate } from "@/components/prompt-composer";

/** 引导创建自动化的提示词模板，填入首页输入框后由用户在字段中补充任务与计划。 */
export const GUIDED_AUTOMATION_TEMPLATE: ComposerPromptTemplate = {
  segments: [
    {
      type: "text",
      content:
        "请帮我创建一个定时自动化任务，并在当前工作空间中启用它。请根据下面的信息使用创建自动化工具完成配置：\n\n任务内容：",
    },
    {
      type: "input",
      placeholder: "描述自动化要执行的任务…",
    },
    {
      type: "text",
      content: "\n执行计划：",
    },
    {
      type: "select",
      placeholder: "选择执行频率",
      options: [
        { label: "每天早上 9 点", value: "每天早上 9 点" },
        { label: "每个工作日早上 9 点", value: "每个工作日（周一至周五）早上 9 点" },
        { label: "每周一早上 9 点", value: "每周一早上 9 点" },
        { label: "每月 1 日早上 9 点", value: "每月 1 日早上 9 点" },
        { label: "每小时执行一次", value: "每小时执行一次" },
        { label: "自定义时间", value: "自定义时间（请在消息中补充具体时间）" },
      ],
    },
    {
      type: "text",
      content: "。如有其他要求（如模型、名称），请一并补充。",
    },
  ],
};
