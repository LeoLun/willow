const translations: Record<string, Record<string, string>> = {
  en: {
    "Error:": "Error:",
    "Request aborted": "Request aborted",
    console: "console",
    "Copy output": "Copy output",
    "Copied!": "Copied!",
    "Copy code": "Copy code",
    "(no output)": "(no output)",
    "(no result)": "(no result)",
    Input: "Input",
    Output: "Output",
    Call: "Call",
    Result: "Result",
    "Preparing tool parameters...": "Preparing tool parameters...",
    "Preparing tool...": "Preparing tool...",
    "Waiting for command...": "Waiting for command...",
    "Running command...": "Running command...",
    "Thinking...": "Thinking...",
    "Tool Call": "Tool Call",
    Remove: "Remove",
    Free: "Free",
    PDF: "PDF",
  },
  zh: {
    "Error:": "错误：",
    "Request aborted": "请求已中止",
    console: "控制台",
    "Copy output": "复制输出",
    "Copied!": "已复制！",
    "Copy code": "复制代码",
    "(no output)": "（无输出）",
    "(no result)": "（无结果）",
    Input: "输入",
    Output: "输出",
    Call: "调用",
    Result: "结果",
    "Preparing tool parameters...": "正在准备工具参数...",
    "Preparing tool...": "正在准备工具...",
    "Waiting for command...": "等待命令...",
    "Running command...": "正在运行命令...",
    "Thinking...": "思考中...",
    "Tool Call": "工具调用",
    Remove: "移除",
    Free: "免费",
    PDF: "PDF",
  },
};

let currentLanguage = "en";

export function setLanguage(lang: string) {
  currentLanguage = lang;
}

export function i18n(key: string): string {
  return translations[currentLanguage]?.[key] ?? translations.en?.[key] ?? key;
}
