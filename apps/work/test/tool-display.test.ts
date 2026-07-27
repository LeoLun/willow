import { describe, expect, it } from "vitest";
import {
  formatToolDetails,
  formatToolCallTitle,
  formatToolResultTitle,
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
});
