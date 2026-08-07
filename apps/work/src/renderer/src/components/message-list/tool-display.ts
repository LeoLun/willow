import type { AskUserToolDetails, WebSearchToolDetails, WillowToolDetails } from "@willow/core";
import {
  WrenchIcon,
  FilePlusIcon,
  PencilIcon,
  ListIcon,
  SearchIcon,
  SquareTerminalIcon,
  BookOpenTextIcon,
  GlobeIcon,
  ListTodoIcon,
  MessageCircleQuestionIcon,
  ActivityIcon,
} from "lucide-vue-next";
import type { Component } from "vue";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = "?"): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function countLines(value: string): number {
  if (value === "") return 0;
  const lines = value.split(/\r\n|\n|\r/);
  return lines.length - (lines[lines.length - 1] === "" ? 1 : 0);
}

function pathToName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function formatToolCallTitle(name: string, args: unknown, details?: unknown): string {
  const input = asRecord(args);
  switch (name) {
    case "bash":
      return `$ ${text(input.command)}`;
    case "read": {
      const range =
        typeof input.limit === "number"
          ? `${input.limit} 行`
          : typeof input.offset === "number"
            ? `从第 ${input.offset} 行`
            : "";
      return `读取 ${text(input.path)}${range ? ` · ${range}` : ""}`;
    }
    case "write": {
      const result = asRecord(details);
      const resultPath = result.kind === "write" ? result.path : undefined;
      const path = text(input.path, text(resultPath, ""));
      const content = typeof input.content === "string" ? input.content : "";
      const lineCount =
        typeof input.content === "string"
          ? countLines(content)
          : result.kind === "write" && typeof result.lineCount === "number"
            ? result.lineCount
            : 0;
      if (path === "") return `准备写入 · ${lineCount} 行`;
      return `写入 ${pathToName(path)} · ${lineCount} 行`;
    }
    case "edit":
      return `修改 ${pathToName(text(input.path))}`;
    case "ls":
      return `已列出 ${pathToName(text(input.path, "."))} 中的文件`;
    case "grep":
      return `搜索内容 /${text(input.pattern, "")}/`;
    case "find":
      return `搜索文件 ${text(input.pattern)}`;
    case "processList":
      return input.filter ? `查看进程 · ${text(input.filter)}` : "查看系统进程";
    case "webfetch":
      return `抓取网页 ${text(input.url)}`;
    case "websearch":
      return `搜索 ${text(input.query)}`;
    case "todoList":
      return !Array.isArray(input.todos)
        ? "读取任务列表"
        : input.todos.length === 0
          ? "清空任务列表"
          : `更新任务列表 · ${input.todos.length} 项`;
    case "askUser":
      return `询问 ${Array.isArray(input.questions) ? input.questions.length : 0} 个问题`;
    default:
      return `调用工具 · ${name}`;
  }
}

export function formatToolCallIcon(name: string): Component {
  switch (name) {
    case "bash":
      return SquareTerminalIcon;
    case "read":
      return BookOpenTextIcon;
    case "write":
      return FilePlusIcon;
    case "edit":
      return PencilIcon;
    case "ls":
      return ListIcon;
    case "grep":
      return SearchIcon;
    case "find":
      return SearchIcon;
    case "processList":
      return ActivityIcon;
    case "webfetch":
      return GlobeIcon;
    case "websearch":
      return SearchIcon;
    case "todoList":
      return ListTodoIcon;
    case "askUser":
      return MessageCircleQuestionIcon;
    default:
      return WrenchIcon;
  }
}

export function formatToolResultTitle(details: unknown): string | undefined {
  const value = asRecord(details) as Partial<WillowToolDetails>;
  if (typeof value.msg === "string" && value.msg.trim() !== "") return value.msg;
  switch (value.kind) {
    case "bash":
      return `$ ${value.command}`;
    case "read":
      return `读取 ${value.path} · ${value.lineCount} 行`;
    case "write":
      return `写入 ${value.path} · ${value.lineCount} 行`;
    case "edit":
      return `修改 ${value.path} · +${value.addedLines} -${value.removedLines}`;
    case "ls":
      return `查询 ${value.path}`;
    case "grep":
      return `搜索内容 /${value.pattern}/`;
    case "find":
      return `搜索文件 ${value.pattern}`;
    case "processList":
      return value.filter ? `查看进程 · ${value.filter}` : "查看系统进程";
    case "webfetch":
      return `抓取网页 ${value.finalUrl}`;
    case "websearch":
      return `搜索 ${value.query}`;
    case "todoList":
      return `更新任务列表 · ${value.todos?.length ?? 0} 项`;
    case "askUser":
      return `询问 ${value.questions?.length ?? 0} 个问题`;
    default:
      return undefined;
  }
}

export function getAskUserDetails(details: unknown): AskUserToolDetails | undefined {
  const value = asRecord(details);
  if (
    value.kind !== "askUser" ||
    typeof value.msg !== "string" ||
    !Array.isArray(value.questions)
  ) {
    return undefined;
  }
  const valid = value.questions.every((entry) => {
    const question = asRecord(entry);
    return (
      typeof question.question === "string" &&
      typeof question.header === "string" &&
      Array.isArray(question.options) &&
      Array.isArray(question.answers) &&
      question.answers.every((answer) => typeof answer === "string")
    );
  });
  return valid ? (value as unknown as AskUserToolDetails) : undefined;
}

export function formatToolDetails(details: unknown): string {
  const value = asRecord(details);
  const { msg: _msg, ...rest } = value;
  if (Object.keys(rest).length === 0) return "";
  try {
    return JSON.stringify(rest, null, 2);
  } catch {
    return String(details);
  }
}

export function getWebSearchDetails(details: unknown): WebSearchToolDetails | undefined {
  const value = asRecord(details);
  if (
    value.kind !== "websearch" ||
    typeof value.msg !== "string" ||
    typeof value.query !== "string" ||
    (value.searchDepth !== "basic" && value.searchDepth !== "advanced") ||
    typeof value.numResults !== "number" ||
    typeof value.resultCount !== "number" ||
    typeof value.hasAnswer !== "boolean" ||
    !Array.isArray(value.results)
  ) {
    return undefined;
  }
  const validResults = value.results.every((result) => {
    const item = asRecord(result);
    return (
      typeof item.title === "string" &&
      typeof item.url === "string" &&
      (item.favicon === undefined || typeof item.favicon === "string")
    );
  });
  return validResults ? (value as unknown as WebSearchToolDetails) : undefined;
}

export function getSafeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function getSafeFaviconUrl(value: unknown): string | undefined {
  const url = getSafeExternalUrl(value);
  return url?.startsWith("https:") ? url : undefined;
}
