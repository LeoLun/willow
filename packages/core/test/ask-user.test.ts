import { describe, expect, it, vi } from "vitest";
import { createAskUserTool, type AskUserHandler } from "../src/index.js";

const questions = [
  {
    header: "实现",
    question: "选择哪种实现方式？",
    options: [
      { label: "方案 A (Recommended)", description: "改动较小" },
      { label: "方案 B", description: "扩展性更强" },
    ],
    multiSelect: false,
  },
];

const runtime = (requestUser?: AskUserHandler) => ({
  cwd: process.cwd(),
  permissionMode: "full-access" as const,
  requestUser,
});

describe("askUser tool", () => {
  it("returns structured answers and display details", async () => {
    const requestUser = vi.fn<AskUserHandler>(async () => ({
      "选择哪种实现方式？": ["方案 A (Recommended)"],
    }));
    const tool = createAskUserTool(runtime(requestUser));

    const result = await tool.execute("ask-call", { questions });

    expect(requestUser).toHaveBeenCalledWith({ toolCallId: "ask-call", questions }, undefined);
    expect(result.details).toEqual({
      kind: "askUser",
      msg: "询问 1 个问题",
      questions: [{ ...questions[0], answers: ["方案 A (Recommended)"] }],
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: JSON.stringify({ answers: { "选择哪种实现方式？": ["方案 A (Recommended)"] } }),
    });
  });

  it("records a dismissed question without treating it as an error", async () => {
    const tool = createAskUserTool(runtime(async () => undefined));
    const result = await tool.execute("dismiss", { questions });

    expect(result.details.questions[0]?.answers).toEqual([]);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("User dismissed the questions without answering"),
    });
  });

  it("rejects duplicate question text and option labels before requesting input", async () => {
    const requestUser = vi.fn<AskUserHandler>();
    const tool = createAskUserTool(runtime(requestUser));

    await expect(
      tool.execute("duplicate-question", { questions: [...questions, ...questions] }),
    ).rejects.toThrow("Duplicate question text");
    await expect(
      tool.execute("duplicate-option", {
        questions: [
          {
            ...questions[0],
            options: [
              { label: "相同", description: "第一项" },
              { label: "相同", description: "第二项" },
            ],
          },
        ],
      }),
    ).rejects.toThrow("Duplicate option label");
    expect(requestUser).not.toHaveBeenCalled();
  });

  it("fails clearly when the client has no question handler", async () => {
    const tool = createAskUserTool(runtime());
    await expect(tool.execute("unsupported", { questions })).rejects.toThrow(
      "does not support interactive questions",
    );
  });
});
