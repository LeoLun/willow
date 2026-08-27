import "reflect-metadata";
import { AgentHarness, type AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import type { AskUserHandler, ToolApprovalHandler, ToolApprovalRequest } from "@willow/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentService } from "../src/main/service/agent.service";
import type { AiToolApprovalService } from "../src/main/service/ai-tool-approval.service";
import type { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import type { EventService } from "../src/main/service/event.service";
import type { LocalFileService } from "../src/main/service/local-file.service";
import {
  MessageService,
  UnattendedInteractionError,
  type SendMessageInput,
} from "../src/main/service/message.service";
import { PermissionModeService } from "../src/main/service/permission-mode.service";
import type { SessionService } from "../src/main/service/session.service";
import type { TitleService } from "../src/main/service/title.service";
import type { ToolApprovalService } from "../src/main/service/tool-approval.service";
import type { TurnArtifactService } from "../src/main/service/turn-artifact.service";
import type { UserQuestionService } from "../src/main/service/user-question.service";

const model = { id: "model" } as Model<any>;
const modelConfig = { providerId: "openai", modelId: "large" };
const assistantMessage: AssistantMessage = {
  role: "assistant",
  content: [{ type: "text", text: "Done" }],
  api: "openai-completions",
  provider: "openai",
  model: "model",
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

const approvalRequest: ToolApprovalRequest = {
  toolCallId: "call-1",
  toolName: "bash",
  input: { command: "rm -rf /tmp/test" },
  reason: "outside-workspace-write",
  display: "执行命令：rm -rf /tmp/test",
};

function createHarness() {
  let listener:
    | ((event: AgentHarnessEvent, signal?: AbortSignal) => Promise<void> | void)
    | undefined;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((next: typeof listener) => {
    listener = next;
    return unsubscribe;
  });
  const abort = vi.fn(async () => ({ clearedSteer: [], clearedFollowUp: [] }));
  const harness = {
    prompt: vi.fn(async () => assistantMessage),
    subscribe,
    abort,
    env: { cleanup: vi.fn(async () => undefined) },
  } as unknown as AgentHarness;
  return { harness, prompt: harness.prompt };
}

describe("MessageService unattended mode", () => {
  let getModel: ReturnType<typeof vi.fn>;
  let getAgentHarness: ReturnType<typeof vi.fn>;
  let review: ReturnType<typeof vi.fn>;
  let requestApproval: ReturnType<typeof vi.fn>;
  let requestQuestion: ReturnType<typeof vi.fn>;
  let service: MessageService;
  let permissionModeService: PermissionModeService;
  let capturedOptions: {
    requestApproval?: ToolApprovalHandler;
    requestUser?: AskUserHandler;
  };

  beforeEach(() => {
    getModel = vi.fn(() => model);
    getAgentHarness = vi.fn(
      async (options: { requestApproval?: ToolApprovalHandler; requestUser?: AskUserHandler }) => {
        capturedOptions = options;
        return createHarness().harness;
      },
    );
    review = vi.fn();
    requestApproval = vi.fn();
    requestQuestion = vi.fn();
    capturedOptions = {};

    const sessionService = {
      getSession: vi.fn(() => ({ id: "session-1", title: "" })),
      getBranch: vi.fn(async () => []),
    } as unknown as SessionService;
    const agentService = { getModel, getAgentHarness } as unknown as AgentService;
    const eventService = { sendEvent: vi.fn() } as unknown as EventService;
    const workspaceDao = {
      findById: vi.fn(() => ({ id: 1, path: "/workspace" })),
    } as unknown as WorkspaceDao;
    const localFileService = {
      inspect: vi.fn(async () => []),
      loadImages: vi.fn(async () => []),
    } as unknown as LocalFileService;
    const titleService = { startTitleCreation: vi.fn() } as unknown as TitleService;
    const aiToolApprovalService = { review } as unknown as AiToolApprovalService;
    const toolApprovalService = { request: requestApproval } as unknown as ToolApprovalService;
    const userQuestionService = {
      request: requestQuestion,
    } as unknown as UserQuestionService;
    const turnArtifactService = {
      begin: vi.fn(async () => ({
        complete: vi.fn(async () => undefined),
        dispose: vi.fn(async () => undefined),
        recordMessage: vi.fn(),
      })),
    } as unknown as TurnArtifactService;

    permissionModeService = new PermissionModeService();
    service = new MessageService(
      sessionService,
      agentService,
      eventService,
      workspaceDao,
      localFileService,
      titleService,
      aiToolApprovalService,
      toolApprovalService,
      userQuestionService,
      turnArtifactService,
      permissionModeService,
    );
  });

  function baseInput(): SendMessageInput {
    return {
      workspaceId: 1,
      sessionId: "session-1",
      content: "run the task",
      model: modelConfig,
    };
  }

  function setMode(mode: "request-approval" | "delegate-approval" | "full-access"): void {
    permissionModeService.set(1, "session-1", mode);
  }

  it("allows tool calls when the AI approval approves them", async () => {
    review.mockResolvedValue({ status: "approved", reason: "任务需要" });
    setMode("delegate-approval");
    await service.sendMessage({
      ...baseInput(),
      interactionMode: "unattended",
    });

    const handler = capturedOptions.requestApproval!;
    await expect(handler(approvalRequest)).resolves.toBe("allow");
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("throws for rejected AI approvals without falling back to human approval", async () => {
    review.mockResolvedValue({ status: "rejected", reason: "操作风险过高" });
    setMode("delegate-approval");
    await service.sendMessage({
      ...baseInput(),
      interactionMode: "unattended",
    });

    const handler = capturedOptions.requestApproval!;
    await expect(handler(approvalRequest)).rejects.toThrow(UnattendedInteractionError);
    await expect(handler(approvalRequest)).rejects.toThrow("操作风险过高");
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("throws for failed or timed-out AI approvals without falling back", async () => {
    review.mockResolvedValue({ status: "failed", reason: "AI 审批超时，请由用户确认。" });
    setMode("delegate-approval");
    await service.sendMessage({
      ...baseInput(),
      interactionMode: "unattended",
    });

    const handler = capturedOptions.requestApproval!;
    await expect(handler(approvalRequest)).rejects.toThrow("AI 审批超时，请由用户确认。");
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("fails closed without consulting AI for human-only reviews", async () => {
    setMode("delegate-approval");
    await service.sendMessage({
      ...baseInput(),
      interactionMode: "unattended",
    });

    const handler = capturedOptions.requestApproval!;
    await expect(handler({ ...approvalRequest, autoReviewable: false })).rejects.toThrow(
      "必须由用户亲自确认",
    );
    expect(review).not.toHaveBeenCalled();
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("throws when a non-delegate mode is used unattended", async () => {
    setMode("request-approval");
    await service.sendMessage({
      ...baseInput(),
      interactionMode: "unattended",
    });

    const handler = capturedOptions.requestApproval!;
    await expect(handler(approvalRequest)).rejects.toThrow(UnattendedInteractionError);
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("throws for ask-user instead of persisting a pending question", async () => {
    setMode("delegate-approval");
    await service.sendMessage({
      ...baseInput(),
      interactionMode: "unattended",
    });

    const handler = capturedOptions.requestUser!;
    await expect(
      handler(
        {
          toolCallId: "call-q",
          questions: [
            {
              question: "继续吗？",
              options: [{ label: "是" }, { label: "否" }],
              multiSelect: false,
            },
          ],
        },
        undefined,
      ),
    ).rejects.toThrow(UnattendedInteractionError);
    expect(requestQuestion).not.toHaveBeenCalled();
  });

  it("keeps interactive approvals unchanged", async () => {
    requestApproval.mockResolvedValue("deny");
    setMode("request-approval");
    await service.sendMessage(baseInput());

    const handler = capturedOptions.requestApproval!;
    await expect(handler(approvalRequest)).resolves.toBe("deny");
    expect(requestApproval).toHaveBeenCalledTimes(1);
    expect(review).not.toHaveBeenCalled();
  });

  it("keeps interactive delegate-approval fallback behavior unchanged", async () => {
    review.mockResolvedValue({ status: "rejected", reason: "由用户确认" });
    requestApproval.mockResolvedValue("allow");
    setMode("delegate-approval");
    await service.sendMessage(baseInput());

    const handler = capturedOptions.requestApproval!;
    await expect(handler(approvalRequest)).resolves.toBe("allow");
    expect(requestApproval).toHaveBeenCalledTimes(1);
  });

  it("sends human-only delegated reviews directly to the user", async () => {
    requestApproval.mockResolvedValue("allow");
    setMode("delegate-approval");
    await service.sendMessage(baseInput());

    const handler = capturedOptions.requestApproval!;
    await expect(handler({ ...approvalRequest, autoReviewable: false })).resolves.toBe("allow");
    expect(review).not.toHaveBeenCalled();
    expect(requestApproval).toHaveBeenCalledTimes(1);
  });

  it("does not auto-accept a human-only escalation in full-access mode", async () => {
    requestApproval.mockResolvedValue("allow");
    setMode("full-access");
    await service.sendMessage(baseInput());

    const handler = capturedOptions.requestApproval!;
    await expect(handler({ ...approvalRequest, autoReviewable: false })).resolves.toBe("allow");
    expect(review).not.toHaveBeenCalled();
    expect(requestApproval).toHaveBeenCalledTimes(1);
  });

  it("keeps interactive ask-user behavior unchanged", async () => {
    requestQuestion.mockResolvedValue({ question: { "继续吗？": ["是"] } });
    setMode("request-approval");
    await service.sendMessage(baseInput());

    const handler = capturedOptions.requestUser!;
    await expect(
      handler(
        {
          toolCallId: "call-q",
          questions: [
            {
              question: "继续吗？",
              options: [{ label: "是" }, { label: "否" }],
              multiSelect: false,
            },
          ],
        },
        undefined,
      ),
    ).resolves.toEqual({ question: { "继续吗？": ["是"] } });
    expect(requestQuestion).toHaveBeenCalledTimes(1);
  });
});
