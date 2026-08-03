import "reflect-metadata";
import type { AgentHarness } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentService } from "../src/main/service/agent.service";
import { AiToolApprovalService } from "../src/main/service/ai-tool-approval.service";
import type { UserConfigService } from "../src/main/service/user-config.service";

const model = { id: "small" } as Model<any>;
const request = {
  toolCallId: "call",
  toolName: "bash" as const,
  input: { command: "curl https://example.com" },
  reason: "sandbox-denied" as const,
  display: "curl https://example.com",
};

function response(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: "openai",
    model: "small",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 1,
  };
}

describe("AiToolApprovalService", () => {
  const prompt = vi.fn<AgentHarness["prompt"]>();
  const abort = vi.fn<AgentHarness["abort"]>();
  const cleanup = vi.fn(async () => undefined);
  const getModel = vi.fn<AgentService["getModel"]>();
  const getSimpleAgent = vi.fn<AgentService["getSimpleAgent"]>();
  const getConfig = vi.fn<UserConfigService["getConfig"]>();
  const harness = {
    prompt,
    abort,
    env: { cleanup },
  } as unknown as AgentHarness;
  const agentService = { getModel, getSimpleAgent } as unknown as AgentService;
  const userConfigService = { getConfig } as unknown as UserConfigService;
  let service: AiToolApprovalService;

  beforeEach(() => {
    service = new AiToolApprovalService(agentService, userConfigService);
    getConfig.mockReturnValue({
      smallModel: { providerId: "openai", modelId: "small" },
    });
    getModel.mockReturnValue(model);
    getSimpleAgent.mockResolvedValue(harness);
    abort.mockResolvedValue({ clearedSteer: [], clearedFollowUp: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("approves only a strict allow response and sends bounded task context", async () => {
    prompt.mockResolvedValue(
      response('{"decision":"allow","reason":" 此操作是完成任务所必需的。 "}'),
    );

    await expect(
      service.review({
        workspaceId: 1,
        sessionId: "session",
        workspacePath: "/workspace",
        userMessage: "Fetch the requested URL",
        request,
      }),
    ).resolves.toEqual({ status: "approved", reason: "此操作是完成任务所必需的。" });
    expect(getSimpleAgent).toHaveBeenCalledWith(
      expect.objectContaining({ source: "approval", workspaceId: 1, sessionId: "session" }),
    );
    expect(JSON.parse(prompt.mock.calls[0][0])).toEqual(
      expect.objectContaining({
        userMessage: "Fetch the requested URL",
        workspacePath: "/workspace",
        tool: expect.objectContaining({ name: "bash", reason: "sandbox-denied" }),
      }),
    );
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("returns a normalized rejection reason for user fallback", async () => {
    prompt.mockResolvedValue(
      response('{"decision":"deny","reason":"操作范围过大。\\n  请由用户确认。"}'),
    );

    await expect(
      service.review({
        workspaceId: 1,
        sessionId: "session",
        workspacePath: "/workspace",
        userMessage: "Clean files",
        request,
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "操作范围过大。 请由用户确认。",
    });
  });

  it("fails closed when the model does not explain its decision in Chinese", async () => {
    prompt.mockResolvedValue(response('{"decision":"deny","reason":"Too broad."}'));

    await expect(
      service.review({
        workspaceId: 1,
        sessionId: "session",
        workspacePath: "/workspace",
        userMessage: "Clean files",
        request,
      }),
    ).resolves.toEqual({
      status: "failed",
      reason: "AI 审批未使用中文说明理由，请由用户确认。",
    });
  });

  it.each([
    ["markdown output", '```json\n{"decision":"allow","reason":"ok"}\n```'],
    ["extra fields", '{"decision":"allow","reason":"ok","extra":true}'],
    ["missing reason", '{"decision":"allow"}'],
  ])("fails closed for %s", async (_name, output) => {
    prompt.mockResolvedValue(response(output));

    const result = await service.review({
      workspaceId: 1,
      sessionId: "session",
      workspacePath: "/workspace",
      userMessage: "Run",
      request,
    });

    expect(result.status).toBe("failed");
  });

  it("falls back when no small model is configured", async () => {
    getConfig.mockReturnValue({});

    await expect(
      service.review({
        workspaceId: 1,
        sessionId: "session",
        workspacePath: "/workspace",
        userMessage: "Run",
        request,
      }),
    ).resolves.toEqual({
      status: "failed",
      reason: "未配置小模型，无法执行 AI 审批。",
    });
    expect(getSimpleAgent).not.toHaveBeenCalled();
  });

  it("falls back for model lookup and provider call failures", async () => {
    getModel.mockImplementationOnce(() => {
      throw new Error("model unavailable");
    });
    const input = {
      workspaceId: 1,
      sessionId: "session",
      workspacePath: "/workspace",
      userMessage: "Run",
      request,
    };

    await expect(service.review(input)).resolves.toEqual({
      status: "failed",
      reason: "AI 审批调用失败，请由用户确认。",
    });

    prompt.mockRejectedValueOnce(new Error("provider failed"));
    await expect(service.review(input)).resolves.toEqual({
      status: "failed",
      reason: "AI 审批调用失败，请由用户确认。",
    });
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("aborts and falls back after the 15 second review timeout", async () => {
    vi.useFakeTimers();
    prompt.mockImplementation(() => new Promise(() => undefined));
    const reviewing = service.review({
      workspaceId: 1,
      sessionId: "session",
      workspacePath: "/workspace",
      userMessage: "Run",
      request,
    });
    await Promise.resolve();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(reviewing).resolves.toEqual({
      status: "failed",
      reason: "AI 审批超时，请由用户确认。",
    });
    expect(abort).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("aborts an in-flight review without approving it", async () => {
    const controller = new AbortController();
    prompt.mockImplementation(() => new Promise(() => undefined));
    const reviewing = service.review(
      {
        workspaceId: 1,
        sessionId: "session",
        workspacePath: "/workspace",
        userMessage: "Run",
        request,
      },
      controller.signal,
    );

    controller.abort();

    await expect(reviewing).resolves.toEqual({
      status: "failed",
      reason: "任务已停止，AI 审批已取消。",
    });
    expect(abort).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
