import { describe, expect, it } from "vitest";
import {
  formatToolDetails,
  formatToolCallTitle,
  formatToolResultTitle,
  getAskUserDetails,
  getSafeExternalUrl,
  getSafeFaviconUrl,
  getWebSearchDetails,
} from "../src/renderer/src/components/message-list/tool-display";

describe("tool display summaries", () => {
  it.each([
    ["bash", { command: "pnpm test" }, "$ pnpm test"],
    ["read", { path: "src/main.ts", limit: 20 }, "读取 src/main.ts · 20 行"],
    ["write", { path: "a.txt", content: "one\ntwo" }, "写入 a.txt · 2 行"],
    ["edit", { path: "a.txt" }, "修改 a.txt"],
    ["ls", { path: "src" }, "查询 src"],
    ["grep", { pattern: "needle" }, "搜索内容 /needle/"],
    ["find", { pattern: "**/*.ts" }, "搜索文件 **/*.ts"],
    ["processList", { filter: "kdocs-cli" }, "查看进程 · kdocs-cli"],
    ["webfetch", { url: "https://example.com/docs" }, "抓取网页 https://example.com/docs"],
    ["websearch", { query: "Willow 最新消息" }, "搜索 Willow 最新消息"],
    ["todoList", {}, "读取任务列表"],
    ["todoList", { todos: [] }, "清空任务列表"],
    ["todoList", { todos: [{ title: "实现工具", status: "in_progress" }] }, "更新任务列表 · 1 项"],
    ["askUser", { questions: [{}, {}] }, "询问 2 个问题"],
    ["listAutomations", {}, "查询当前工作空间的自动化"],
    ["createAutomation", { cronExpression: "0 9 * * *" }, "创建定时任务 · 0 9 * * *"],
    ["updateAutomation", { automationId: 7 }, "修改自动化 #7"],
    ["deleteAutomation", { automationId: 7 }, "删除自动化 #7"],
  ])("formats %s calls", (name, input, expected) => {
    expect(formatToolCallTitle(name, input)).toBe(expected);
  });

  it("formats completed tool statistics", () => {
    expect(
      formatToolResultTitle({
        kind: "edit",
        path: "a.txt",
        addedLines: 3,
        removedLines: 1,
        diff: "",
      }),
    ).toBe("修改 a.txt · +3 -1");
    expect(
      formatToolResultTitle({
        kind: "read",
        path: "a.txt",
        offset: 1,
        lineCount: 12,
      }),
    ).toBe("读取 a.txt · 12 行");
    expect(
      formatToolResultTitle({
        kind: "webfetch",
        finalUrl: "https://example.com/docs",
      }),
    ).toBe("抓取网页 https://example.com/docs");
    expect(
      formatToolResultTitle({
        kind: "websearch",
        query: "Willow 最新消息",
      }),
    ).toBe("搜索 Willow 最新消息");
    expect(formatToolResultTitle({ kind: "processList", filter: "kdocs-cli" })).toBe(
      "查看进程 · kdocs-cli",
    );
    expect(
      formatToolResultTitle({
        kind: "todoList",
        todos: [{ title: "实现工具", status: "done" }],
      }),
    ).toBe("更新任务列表 · 1 项");
    expect(formatToolResultTitle({ kind: "askUser", questions: [{}, {}] })).toBe("询问 2 个问题");
    expect(formatToolResultTitle({ kind: "listAutomations", automationCount: 2 })).toBe(
      "已读取 2 条自动化",
    );
    expect(formatToolResultTitle({ kind: "updateAutomation", title: "日报" })).toBe(
      "修改自动化「日报」",
    );
    expect(formatToolResultTitle({ kind: "deleteAutomation", title: "日报" })).toBe(
      "删除自动化「日报」",
    );
  });

  it("shows a pending label until a streamed write path is available", () => {
    expect(formatToolCallTitle("write", { content: "draft" })).toBe("准备写入 · 1 行");
    expect(
      formatToolCallTitle(
        "write",
        { content: "one\ntwo" },
        { kind: "write", path: "docs/说明.md", lineCount: 2 },
      ),
    ).toBe("写入 说明.md · 2 行");
  });

  it("validates askUser details for the dedicated renderer", () => {
    const details = {
      kind: "askUser",
      msg: "询问 1 个问题",
      questions: [
        {
          header: "实现",
          question: "选择实现方式？",
          options: [],
          answers: ["方案 A"],
        },
      ],
    };
    expect(getAskUserDetails(details)).toEqual(details);
    expect(getAskUserDetails({ ...details, questions: [{ question: 1 }] })).toBeUndefined();
  });

  it("prefers the tool-provided summary and removes it from expanded details", () => {
    const details = {
      msg: "读取 a.txt 文件 1-12 行",
      kind: "read",
      path: "a.txt",
      offset: 1,
      lineCount: 12,
    };

    expect(formatToolResultTitle(details)).toBe("读取 a.txt 文件 1-12 行");
    expect(formatToolDetails(details)).toBe(
      JSON.stringify(
        {
          kind: "read",
          path: "a.txt",
          offset: 1,
          lineCount: 12,
        },
        null,
        2,
      ),
    );
  });

  it("validates websearch result details for the dedicated renderer", () => {
    const details = {
      msg: "搜索 Willow",
      kind: "websearch",
      query: "Willow",
      searchDepth: "basic",
      numResults: 5,
      resultCount: 1,
      hasAnswer: true,
      results: [
        {
          title: "Willow",
          url: "https://example.com/result",
          favicon: "https://example.com/favicon.ico",
        },
      ],
    };

    expect(getWebSearchDetails(details)).toEqual(details);
    expect(
      getWebSearchDetails({ ...details, results: [{ title: "missing URL" }] }),
    ).toBeUndefined();
  });

  it("allows only HTTP links and HTTPS favicons", () => {
    expect(getSafeExternalUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(getSafeExternalUrl("http://example.com/path")).toBe("http://example.com/path");
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(getSafeExternalUrl("not a URL")).toBeUndefined();
    expect(getSafeFaviconUrl("https://example.com/favicon.ico")).toBe(
      "https://example.com/favicon.ico",
    );
    expect(getSafeFaviconUrl("http://example.com/favicon.ico")).toBeUndefined();
  });
});
