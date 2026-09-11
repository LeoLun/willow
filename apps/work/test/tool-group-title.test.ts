import { describe, expect, it } from "vitest";
import {
  formatToolGroupTitle,
  type ToolGroupEntry,
} from "../src/renderer/src/components/message-list/tool-display";

const call = (name: string): ToolGroupEntry => ({
  key: name,
  toolCall: { type: "toolCall", id: name, name, arguments: {} },
});
describe("tool group title", () => {
  it("counts calls by category in first appearance order", () => {
    expect(formatToolGroupTitle([call("read"), call("bash"), call("read")])).toBe(
      "读取文件 2 次、运行命令 1 次",
    );
  });
  it("falls back through result names and kinds and counts failures once", () => {
    const result = {
      id: "r",
      sourceKey: "r",
      role: "toolResult" as const,
      timestamp: 1,
      status: "completed" as const,
      content: [],
      toolName: "bash",
      details: { kind: "edit" },
      isError: true,
    };
    expect(
      formatToolGroupTitle([
        { ...call("read"), result },
        { key: "r", result },
        { key: "kind", result: { ...result, toolName: undefined, isError: false } },
        call("custom"),
        { key: "unknown" },
      ]),
    ).toBe(
      "读取文件 1 次、运行命令 1 次、编辑文件 1 次、调用 custom 1 次、工具调用 1 次、失败 2 次",
    );
  });
});
