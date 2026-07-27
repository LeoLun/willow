import type { WillowToolDetails } from "@willow/core";
import {
  WrenchIcon,
  FilePlusIcon,
  PencilIcon,
  ListIcon,
  SearchIcon,
  SquareTerminalIcon,
  BookOpenTextIcon,
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

export function formatToolCallTitle(name: string, args: unknown): string {
  const input = asRecord(args);
  switch (name) {
    case "bash":
      return `$ ${text(input.command)}`;
    case "read": {
      const range =
        typeof input.limit === "number"
          ? ` · ${input.limit} 行`
          : typeof input.offset === "number"
            ? ` · 从第 ${input.offset} 行`
            : "";
      return `读取 ${pathToName(text(input.path))}${range ? ` · ${range}` : ""}`;
    }
    case "write": {
      const content = typeof input.content === "string" ? input.content : "";
      const lineCount = countLines(content);
      return `写入 ${pathToName(text(input.path))} · ${lineCount} 行`;
    }
    case "edit":
      return `修改 ${pathToName(text(input.path))}`;
    case "ls":
      return `查询 ${pathToName(text(input.path, "."))} 目录`;
    case "grep":
      return `搜索内容 /${text(input.pattern, "")}/`;
    case "find":
      return `搜索文件 ${text(input.pattern)}`;
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
    default:
      return undefined;
  }
}

export function formatToolDetails(details: any): string {
  if (details.msg) {
    return details.msg;
  }

  return "";
}
