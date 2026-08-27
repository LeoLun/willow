import "reflect-metadata";
import { AgentHarness, type AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentService } from "../src/main/service/agent.service";
import type { AiToolApprovalService } from "../src/main/service/ai-tool-approval.service";
import type { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import type { EventService } from "../src/main/service/event.service";
import type { LocalFileService } from "../src/main/service/local-file.service";
import { MessageService } from "../src/main/service/message.service";
import { PermissionModeService } from "../src/main/service/permission-mode.service";
import type { SessionService } from "../src/main/service/session.service";
import type { TitleService } from "../src/main/service/title.service";
import type { ToolApprovalService } from "../src/main/service/tool-approval.service";
import type { TurnArtifactService } from "../src/main/service/turn-artifact.service";
import type { UserQuestionService } from "../src/main/service/user-question.service";
import { MESSAGE_EVENT } from "../src/shared/constants";
import {
  appendLocalFileBlock,
  LOCAL_FILE_GRANT_CUSTOM_TYPE,
  parseLocalFilePrompt,
} from "../src/shared/local-file";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness(prompt = vi.fn(async () => assistantMessage)) {
  let listener:
    | ((event: AgentHarnessEvent, signal?: AbortSignal) => Promise<void> | void)
    | undefined;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((next: typeof listener) => {
    listener = next;
    return unsubscribe;
  });
  const abort = vi.fn(async () => ({ clearedSteer: [], clearedFollowUp: [] }));
  const cleanup = vi.fn(async () => undefined);
  const harness = {
    prompt,
    subscribe,
    abort,
    env: { cleanup },
  } as unknown as AgentHarness;
  return {
    harness,
    prompt,
    subscribe,
    unsubscribe,
    abort,
    cleanup,
    emit: (event: AgentHarnessEvent) => listener?.(event),
  };
}

describe("MessageService", () => {
  const getSession = vi.fn<SessionService["getSession"]>();
  const getMessageList = vi.fn<SessionService["getMessageList"]>();
  const getBranch = vi.fn<SessionService["getBranch"]>();
  const appendCustomEntry = vi.fn<SessionService["appendCustomEntry"]>();
  const getModel = vi.fn<AgentService["getModel"]>();
  const getAgentHarness = vi.fn<AgentService["getAgentHarness"]>();
  const sendEvent = vi.fn<EventService["sendEvent"]>();
  const findById = vi.fn<WorkspaceDao["findById"]>();
  const inspectLocalFiles = vi.fn<LocalFileService["inspect"]>();
  const loadImages = vi.fn<LocalFileService["loadImages"]>();
  const startTitleCreation = vi.fn<TitleService["startTitleCreation"]>();
  const review = vi.fn<AiToolApprovalService["review"]>();
  const requestApproval = vi.fn<ToolApprovalService["request"]>();
  const getPendingApproval = vi.fn<ToolApprovalService["getPendingApproval"]>();
  const resolveApproval = vi.fn<ToolApprovalService["resolve"]>();
  const requestQuestion = vi.fn<UserQuestionService["request"]>();
  const getPendingQuestion = vi.fn<UserQuestionService["getPendingQuestion"]>();
  const resolveQuestion = vi.fn<UserQuestionService["resolve"]>();
  const artifactCapture = {
    complete: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    recordMessage: vi.fn(),
  };
  const beginArtifactCapture = vi.fn(async () => artifactCapture);
  const getArtifacts = vi.fn(() => []);

  const sessionService = {
    appendCustomEntry,
    getBranch,
    getSession,
    getMessageList,
  } as unknown as SessionService;
  const agentService = {
    getModel,
    getAgentHarness,
  } as unknown as AgentService;
  const eventService = { sendEvent } as unknown as EventService;
  const workspaceDao = { findById } as unknown as WorkspaceDao;
  const localFileService = {
    inspect: inspectLocalFiles,
    loadImages,
  } as unknown as LocalFileService;
  const titleService = { startTitleCreation } as unknown as TitleService;
  const aiToolApprovalService = { review } as unknown as AiToolApprovalService;
  const toolApprovalService = {
    getPendingApproval,
    request: requestApproval,
    resolve: resolveApproval,
  } as unknown as ToolApprovalService;
  const userQuestionService = {
    getPendingQuestion,
    request: requestQuestion,
    resolve: resolveQuestion,
  } as unknown as UserQuestionService;
  const turnArtifactService = {
    begin: beginArtifactCapture,
    getArtifacts,
  } as unknown as TurnArtifactService;

  let service: MessageService;
  let permissionModeService: PermissionModeService;

  it("loads an AgentHarness with the persisted-session continuation API", () => {
    expect(AgentHarness.prototype.continue).toBeTypeOf("function");
  });

  beforeEach(() => {
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
    findById.mockReturnValue({
      id: 1,
      name: "Willow",
      path: "/workspace/willow",
    } as never);
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "Existing title",
      createdAt: new Date(0).toISOString(),
    });
    getModel.mockReturnValue(model);
    getBranch.mockResolvedValue([]);
    appendCustomEntry.mockResolvedValue("entry-id");
    inspectLocalFiles.mockImplementation(async (paths) =>
      paths.map((path) => ({ path, name: path.split("/").at(-1) ?? path, fileType: "TXT" })),
    );
    loadImages.mockResolvedValue([]);
    getPendingApproval.mockResolvedValue(undefined);
    getPendingQuestion.mockResolvedValue(undefined);
    getArtifacts.mockReturnValue([]);
  });

  it("opens the persisted session and forwards only message stream events", async () => {
    const order: string[] = [];
    const harness = createHarness(
      vi.fn(async () => {
        order.push("prompt");
        return assistantMessage;
      }),
    );
    harness.subscribe.mockImplementation((_listener) => {
      order.push("subscribe");
      return (() => undefined) as ReturnType<AgentHarness["subscribe"]>;
    });
    getAgentHarness.mockResolvedValue(harness.harness);

    const result = await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: " Hello ",
      model: modelConfig,
    });

    expect(result).toBe(assistantMessage);
    expect(order).toEqual(["subscribe", "prompt"]);
    expect(getModel).toHaveBeenCalledWith("openai", "large");
    expect(getAgentHarness).toHaveBeenCalledWith({
      workspaceId: 1,
      cwd: "/workspace/willow",
      model,
      metadata: expect.objectContaining({ id: "session" }),
      agentMode: "default",
      sandboxPolicy: { allowWrite: [] },
      permissionMode: "request-approval",
      getPermissionMode: expect.any(Function),
      requestApproval: expect.any(Function),
      requestUser: expect.any(Function),
    });
    expect(harness.prompt).toHaveBeenCalledWith("Hello");
    expect(sendEvent).toHaveBeenNthCalledWith(1, MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "started",
    });
    expect(sendEvent).toHaveBeenLastCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "completed",
    });
  });

  it("reports a resolved provider error as failed instead of completed", async () => {
    const providerError = {
      ...assistantMessage,
      content: [],
      stopReason: "error" as const,
      errorMessage: "503: Service is too busy",
    };
    const harness = createHarness(vi.fn(async () => providerError));
    getAgentHarness.mockResolvedValue(harness.harness);

    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "Hi",
        model: modelConfig,
      }),
    ).resolves.toBe(providerError);

    expect(sendEvent).toHaveBeenLastCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "failed",
      error: "503: Service is too busy",
    });
    expect(sendEvent).not.toHaveBeenCalledWith(
      MESSAGE_EVENT,
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("persists attachments and grants current and inherited files to the session sandbox", async () => {
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "",
      createdAt: new Date(0).toISOString(),
    });
    const inheritedGrant = {
      requestId: "previous-request",
      files: [{ path: "/outside/old.md", name: "old.md", fileType: "MD" }],
    };
    getBranch.mockResolvedValue([
      {
        type: "custom",
        customType: LOCAL_FILE_GRANT_CUSTOM_TYPE,
        data: inheritedGrant,
      },
      {
        type: "message",
        message: {
          role: "user",
          content: [{ type: "text", text: appendLocalFileBlock("Earlier", inheritedGrant) }],
          timestamp: 1,
        },
      },
      {
        type: "custom",
        customType: LOCAL_FILE_GRANT_CUSTOM_TYPE,
        data: {
          requestId: "orphan",
          files: [{ path: "/outside/orphan.txt", name: "orphan.txt", fileType: "TXT" }],
        },
      },
    ] as never);
    inspectLocalFiles.mockResolvedValue([
      { path: "/outside/new.txt", name: "new.txt", fileType: "TXT" },
    ]);
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Review these files",
      model: modelConfig,
      attachments: [{ path: "/link/new.txt", name: "ignored", fileType: "ignored" }],
    });

    expect(inspectLocalFiles).toHaveBeenCalledWith(["/link/new.txt"]);
    const persistedGrant = appendCustomEntry.mock.calls[0]?.[3];
    expect(appendCustomEntry).toHaveBeenCalledWith(
      1,
      "session",
      LOCAL_FILE_GRANT_CUSTOM_TYPE,
      expect.objectContaining({
        files: [{ path: "/outside/new.txt", name: "new.txt", fileType: "TXT" }],
      }),
    );
    expect(getAgentHarness).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxPolicy: { allowWrite: ["/outside/old.md", "/outside/new.txt"] },
      }),
    );
    const prompt = harness.prompt.mock.calls[0]?.[0] as string;
    expect(parseLocalFilePrompt(prompt)).toEqual({
      content: "Review these files",
      grant: persistedGrant,
    });
    expect(prompt).not.toContain("orphan.txt");
    expect(startTitleCreation).toHaveBeenCalledWith({
      workspaceId: 1,
      sessionId: "session",
      content: "Review these files",
    });
  });

  it("passes images directly to core and includes all attachments in the local-file grant", async () => {
    const imageAttachment = {
      path: "/outside/photo.png",
      name: "photo.png",
      fileType: "PNG",
      mimeType: "image/png",
    };
    const documentAttachment = {
      path: "/outside/notes.md",
      name: "notes.md",
      fileType: "MD",
    };
    const image = { type: "image" as const, data: "iVBORw==", mimeType: "image/png" };
    inspectLocalFiles.mockResolvedValue([imageAttachment, documentAttachment]);
    loadImages.mockResolvedValue([image]);
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Describe the image and review the notes",
      model: modelConfig,
      attachments: [imageAttachment, documentAttachment],
    });

    expect(loadImages).toHaveBeenCalledWith([imageAttachment]);
    expect(appendCustomEntry).toHaveBeenCalledWith(
      1,
      "session",
      LOCAL_FILE_GRANT_CUSTOM_TYPE,
      expect.objectContaining({ files: [imageAttachment, documentAttachment] }),
    );
    expect(getAgentHarness).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxPolicy: { allowWrite: [imageAttachment.path, documentAttachment.path] },
      }),
    );
    const prompt = harness.prompt.mock.calls[0]?.[0] as string;
    expect(parseLocalFilePrompt(prompt)).toEqual({
      content: "Describe the image and review the notes",
      grant: expect.objectContaining({ files: [imageAttachment, documentAttachment] }),
    });
    expect(harness.prompt).toHaveBeenCalledWith(prompt, { images: [image] });
  });

  it("passes one directory path to the model and grants recursive read-write access", async () => {
    const directory = {
      path: "/outside/project",
      name: "project",
      fileType: "文件夹",
      kind: "directory" as const,
    };
    inspectLocalFiles.mockResolvedValue([directory]);
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Review this project",
      model: modelConfig,
      attachments: [{ ...directory, path: "/link/project" }],
    });

    expect(inspectLocalFiles).toHaveBeenCalledWith(["/link/project"]);
    expect(appendCustomEntry).toHaveBeenCalledWith(
      1,
      "session",
      LOCAL_FILE_GRANT_CUSTOM_TYPE,
      expect.objectContaining({ files: [directory] }),
    );
    expect(getAgentHarness).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxPolicy: { allowWrite: [directory.path] } }),
    );
    const prompt = harness.prompt.mock.calls[0]?.[0] as string;
    expect(parseLocalFilePrompt(prompt)).toEqual({
      content: "Review this project",
      grant: expect.objectContaining({ files: [directory] }),
    });
  });

  it("grants Plan mode read-only access to inherited and new attachments", async () => {
    const inheritedGrant = {
      requestId: "grant-plan",
      files: [{ path: "/outside/context.md", name: "context.md", fileType: "MD" }],
    };
    getBranch.mockResolvedValue([
      {
        type: "custom",
        customType: LOCAL_FILE_GRANT_CUSTOM_TYPE,
        data: inheritedGrant,
      },
      {
        type: "message",
        message: {
          role: "user",
          content: [{ type: "text", text: appendLocalFileBlock("Earlier", inheritedGrant) }],
          timestamp: 1,
        },
      },
    ] as never);
    const directory = {
      path: "/outside/project",
      name: "project",
      fileType: "文件夹",
      kind: "directory" as const,
    };
    inspectLocalFiles.mockResolvedValue([directory]);
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Plan the changes",
      model: modelConfig,
      agentMode: "plan",
      attachments: [directory],
    });

    expect(getAgentHarness).toHaveBeenCalledWith(
      expect.objectContaining({
        agentMode: "plan",
        sandboxPolicy: { allowRead: ["/outside/context.md", "/outside/project"] },
      }),
    );
  });

  it("forwards message events and filters harness-only events", async () => {
    const run = deferred<AssistantMessage>();
    const harness = createHarness(vi.fn(() => run.promise));
    getAgentHarness.mockResolvedValue(harness.harness);

    const sending = service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Hi",
      model: modelConfig,
    });
    await vi.waitFor(() => expect(harness.subscribe).toHaveBeenCalled());
    const messageEvent = {
      type: "message_end",
      message: assistantMessage,
    } satisfies AgentHarnessEvent;
    harness.emit(messageEvent);
    harness.emit({ type: "settled", nextTurnCount: 0 });
    run.resolve(assistantMessage);
    await sending;

    expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "stream",
      sessionId: "session",
      event: { type: "end", message: assistantMessage },
    });
    expect(sendEvent).not.toHaveBeenCalledWith(
      MESSAGE_EVENT,
      expect.objectContaining({
        event: expect.objectContaining({ type: "settled" }),
      }),
    );
    expect(harness.unsubscribe).toHaveBeenCalledOnce();
  });

  it("rejects concurrent sends and aborts an active session", async () => {
    const run = deferred<AssistantMessage>();
    const harness = createHarness(vi.fn(() => run.promise));
    harness.abort.mockImplementation(async () => {
      run.resolve({ ...assistantMessage, stopReason: "aborted" });
      return { clearedSteer: [], clearedFollowUp: [] };
    });
    getAgentHarness.mockResolvedValue(harness.harness);

    const first = service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Hi",
      model: modelConfig,
    });
    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "Again",
        model: modelConfig,
      }),
    ).rejects.toThrow("Session is already running");
    await vi.waitFor(() => expect(harness.prompt).toHaveBeenCalled());
    await expect(service.stopMessage(1, "session")).resolves.toBe(true);
    await first;

    expect(harness.abort).toHaveBeenCalledOnce();
    expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "stopped",
    });
    expect(sendEvent).not.toHaveBeenCalledWith(
      MESSAGE_EVENT,
      expect.objectContaining({ status: "completed" }),
    );
    await expect(service.stopMessage(1, "session")).resolves.toBe(false);
  });

  it("allows different sessions to run concurrently", async () => {
    const firstRun = deferred<AssistantMessage>();
    const secondRun = deferred<AssistantMessage>();
    const firstHarness = createHarness(vi.fn(() => firstRun.promise));
    const secondHarness = createHarness(vi.fn(() => secondRun.promise));
    getAgentHarness
      .mockResolvedValueOnce(firstHarness.harness)
      .mockResolvedValueOnce(secondHarness.harness);

    const first = service.sendMessage({
      workspaceId: 1,
      sessionId: "first",
      content: "One",
      model: modelConfig,
    });
    const second = service.sendMessage({
      workspaceId: 1,
      sessionId: "second",
      content: "Two",
      model: modelConfig,
    });
    await vi.waitFor(() => {
      expect(firstHarness.prompt).toHaveBeenCalledOnce();
      expect(secondHarness.prompt).toHaveBeenCalledOnce();
    });

    firstRun.resolve(assistantMessage);
    secondRun.resolve(assistantMessage);
    await expect(Promise.all([first, second])).resolves.toEqual([
      assistantMessage,
      assistantMessage,
    ]);
  });

  it("cleans up and emits a safe failure status when prompt rejects", async () => {
    const error = new Error("provider secret details");
    const harness = createHarness(vi.fn(async () => Promise.reject(error)));
    getAgentHarness.mockResolvedValue(harness.harness);

    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "Hi",
        model: modelConfig,
      }),
    ).rejects.toBe(error);

    expect(harness.unsubscribe).toHaveBeenCalledOnce();
    expect(sendEvent).toHaveBeenLastCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "failed",
      error: "provider secret details",
    });
  });

  it("delegates active-branch history reads", async () => {
    const messages = [{ role: "user", content: "Hi", timestamp: 1 }] as const;
    getMessageList.mockResolvedValue(messages as never);

    await expect(service.getMessageList(1, "session")).resolves.toEqual({
      messages,
      artifacts: [],
      pendingToolApproval: undefined,
      pendingUserQuestion: undefined,
    });
    expect(getMessageList).toHaveBeenCalledWith(1, "session");
    expect(getPendingApproval).toHaveBeenCalledWith(1, "session");
    expect(getPendingQuestion).toHaveBeenCalledWith(1, "session");
  });

  it("rebuilds and continues a session after answering a persisted question", async () => {
    const questions = [
      {
        header: "范围",
        question: "处理哪些内容？",
        options: [
          { label: "全部", description: "处理全部内容" },
          { label: "部分", description: "仅处理部分内容" },
        ],
      },
    ];
    const answers = { "处理哪些内容？": ["全部"] };
    const execute = vi.fn(async (toolCallId: string) => {
      const requestUser = getAgentHarness.mock.calls.at(-1)?.[0].requestUser;
      const replayedAnswers = await requestUser?.({ toolCallId, questions });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ answers: replayedAnswers }) }],
        details: {
          kind: "askUser",
          msg: "询问 1 个问题",
          questions: [{ ...questions[0], answers: replayedAnswers?.[questions[0].question] ?? [] }],
        },
      };
    });
    const appendMessage = vi.fn(async () => undefined);
    const continueRun = vi.fn(async () => assistantMessage);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage,
      continue: continueRun,
      getTools: () => [{ name: "askUser", execute }],
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const question = {
      model: modelConfig,
      agentMode: "plan" as const,
      permissionMode: "request-approval" as const,
      userMessage: "Ask before continuing",
      payload: {
        requestId: "question-recovered",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "ask-call-recovered",
        questions,
      },
    };
    resolveQuestion.mockResolvedValue({ question, live: false });

    await expect(
      service.resolveUserQuestion({
        requestId: question.payload.requestId,
        workspaceId: question.payload.workspaceId,
        sessionId: question.payload.sessionId,
        answers,
      }),
    ).resolves.toBe(true);

    expect(resolveQuestion).toHaveBeenCalledWith(
      1,
      "session",
      "question-recovered",
      answers,
      "recovered",
    );
    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    expect(getAgentHarness).toHaveBeenCalledWith(
      expect.objectContaining({ agentMode: "plan", sandboxPolicy: { allowRead: [] } }),
    );
    expect(execute).toHaveBeenCalledWith("ask-call-recovered", { questions });
    expect(requestQuestion).not.toHaveBeenCalled();
    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "toolResult",
        toolCallId: "ask-call-recovered",
        toolName: "askUser",
        isError: false,
        details: expect.objectContaining({
          questions: [expect.objectContaining({ answers: ["全部"] })],
        }),
      }),
    );
    await vi.waitFor(() =>
      expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
        type: "status",
        sessionId: "session",
        status: "completed",
      }),
    );
  });

  it("starts title creation for an untitled session", async () => {
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "",
      createdAt: new Date(0).toISOString(),
    });
    const mainHarness = createHarness();
    getAgentHarness.mockResolvedValue(mainHarness.harness);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "First",
      model: modelConfig,
    });

    expect(startTitleCreation).toHaveBeenCalledWith({
      workspaceId: 1,
      sessionId: "session",
      content: "First",
    });
  });

  it("passes a static Bash snapshot and a live non-Bash permission provider", async () => {
    permissionModeService.set(1, "session", "request-approval");
    getAgentHarness.mockResolvedValue(createHarness().harness);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Inspect files",
      model: modelConfig,
    });

    const options = getAgentHarness.mock.calls.at(-1)?.[0];
    expect(options?.permissionMode).toBe("request-approval");
    expect(options?.getPermissionMode()).toBe("request-approval");

    permissionModeService.set(1, "session", "full-access");
    expect(options?.permissionMode).toBe("request-approval");
    expect(options?.getPermissionMode()).toBe("full-access");

    requestApproval.mockResolvedValue("allow");
    await expect(
      options?.requestApproval?.({
        toolCallId: "bash-snapshot",
        toolName: "bash",
        input: { command: "cat /outside/file" },
        permissionMode: "request-approval",
        reason: "outside-workspace-read",
        display: "/outside/file",
      }),
    ).resolves.toBe("allow");
    expect(requestApproval).toHaveBeenCalledOnce();

    await expect(
      options?.requestApproval?.({
        toolCallId: "started-before-switch",
        toolName: "read",
        input: { path: "/outside/file" },
        permissionMode: "request-approval",
        reason: "outside-workspace-read",
        display: "/outside/file",
      }),
    ).resolves.toBe("allow");
    expect(requestApproval).toHaveBeenCalledTimes(2);

    await expect(
      options?.requestApproval?.({
        toolCallId: "dynamic-read",
        toolName: "read",
        input: { path: "/outside/file" },
        permissionMode: "full-access",
        reason: "outside-workspace-read",
        display: "/outside/file",
      }),
    ).resolves.toBe("allow");
    expect(requestApproval).toHaveBeenCalledTimes(2);
  });

  it("uses AI approval for delegated escapes and skips the user dialog when approved", async () => {
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);
    review.mockResolvedValue({ status: "approved", reason: "Matches the current task." });

    permissionModeService.set(1, "session", "delegate-approval");
    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Install the requested package",
      model: modelConfig,
    });
    const handler = getAgentHarness.mock.calls.at(-1)?.[0].requestApproval;
    const decision = await handler?.({
      toolCallId: "call",
      toolName: "bash",
      input: { command: "pnpm install" },
      reason: "sandbox-denied",
      display: "pnpm install",
    });

    expect(decision).toBe("allow");
    expect(review).toHaveBeenCalledWith(
      expect.objectContaining({
        workspacePath: "/workspace/willow",
        userMessage: "Install the requested package",
      }),
      undefined,
    );
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("falls back to one-time user approval when AI rejects or fails", async () => {
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);
    review.mockResolvedValue({ status: "rejected", reason: "The command is too broad." });
    requestApproval.mockResolvedValue("allow");

    permissionModeService.set(1, "session", "delegate-approval");
    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Clean generated files",
      model: modelConfig,
    });
    const handler = getAgentHarness.mock.calls.at(-1)?.[0].requestApproval;
    const toolRequest = {
      toolCallId: "call",
      toolName: "bash" as const,
      input: { command: "rm -rf /tmp/output" },
      reason: "sandbox-denied" as const,
      display: "rm -rf /tmp/output",
    };

    await expect(handler?.(toolRequest)).resolves.toBe("allow");
    expect(requestApproval).toHaveBeenCalledWith(
      1,
      "session",
      toolRequest,
      {
        model: modelConfig,
        agentMode: "default",
        permissionMode: "delegate-approval",
        userMessage: "Clean generated files",
      },
      undefined,
      {
        status: "rejected",
        reason: "The command is too broad.",
      },
    );
  });

  it("rebuilds and continues a session after resolving a persisted approval", async () => {
    const execute = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "outside contents" }],
      details: { path: "/outside/file.txt" },
    }));
    const appendMessage = vi.fn(async () => undefined);
    const continuation = deferred<AssistantMessage>();
    const continueRun = vi.fn(() => continuation.promise);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage,
      continue: continueRun,
      getTools: () => [{ name: "read", execute }],
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const approval = {
      model: modelConfig,
      permissionMode: "request-approval" as const,
      userMessage: "Read the outside file",
      payload: {
        approvalId: "approval-recovered",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "call-recovered",
        toolName: "read" as const,
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read" as const,
        display: "/outside/file.txt",
      },
    };
    resolveApproval.mockResolvedValue({ approval, live: false });
    await expect(
      service.resolveToolApproval({
        approvalId: approval.payload.approvalId,
        workspaceId: approval.payload.workspaceId,
        sessionId: approval.payload.sessionId,
        decision: "allow",
      }),
    ).resolves.toBe(true);

    expect(resolveApproval).toHaveBeenCalledWith(
      1,
      "session",
      "approval-recovered",
      "allow",
      "recovered",
    );
    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    expect(execute).toHaveBeenCalledWith("call-recovered", {
      path: "/outside/file.txt",
    });
    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "toolResult",
        toolCallId: "call-recovered",
        toolName: "read",
        isError: false,
      }),
    );
    expect(sendEvent).not.toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "completed",
    });

    continuation.resolve(assistantMessage);
    await vi.waitFor(() =>
      expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
        type: "status",
        sessionId: "session",
        status: "completed",
      }),
    );
  });

  it("returns a recovered approval response before the continued agent finishes", async () => {
    const continuation = deferred<AssistantMessage>();
    const continueRun = vi.fn(() => continuation.promise);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage: vi.fn(async () => undefined),
      continue: continueRun,
      getTools: () => [],
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const approval = {
      model: modelConfig,
      permissionMode: "request-approval" as const,
      userMessage: "Read the outside file",
      payload: {
        approvalId: "approval-immediate",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "call-immediate",
        toolName: "read" as const,
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read" as const,
        display: "/outside/file.txt",
      },
    };
    resolveApproval.mockResolvedValue({ approval, live: false });
    const resolved = service.resolveToolApproval({
      approvalId: approval.payload.approvalId,
      workspaceId: approval.payload.workspaceId,
      sessionId: approval.payload.sessionId,
      decision: "deny",
    });

    await expect(resolved).resolves.toBe(true);
    expect(resolveApproval).toHaveBeenCalledWith(
      1,
      "session",
      "approval-immediate",
      "deny",
      "recovered",
    );
    expect(sendEvent).not.toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "completed",
    });

    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    continuation.resolve(assistantMessage);
    await vi.waitFor(() =>
      expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
        type: "status",
        sessionId: "session",
        status: "completed",
      }),
    );
  });

  it("continues a recovered session without executing the tool after denial", async () => {
    const appendMessage = vi.fn(async () => undefined);
    const continueRun = vi.fn(async () => assistantMessage);
    const getTools = vi.fn(() => []);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage,
      continue: continueRun,
      getTools,
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const approval = {
      model: modelConfig,
      permissionMode: "request-approval" as const,
      userMessage: "Read the outside file",
      payload: {
        approvalId: "approval-denied",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "call-denied",
        toolName: "read" as const,
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read" as const,
        display: "/outside/file.txt",
      },
    };
    resolveApproval.mockResolvedValue({ approval, live: false });
    await expect(
      service.resolveToolApproval({
        approvalId: approval.payload.approvalId,
        workspaceId: approval.payload.workspaceId,
        sessionId: approval.payload.sessionId,
        decision: "deny",
      }),
    ).resolves.toBe(true);

    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    expect(getTools).not.toHaveBeenCalled();
    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "toolResult",
        toolCallId: "call-denied",
        isError: true,
        content: [{ type: "text", text: "用户拒绝了此工具调用。" }],
      }),
    );
    expect(resolveApproval).toHaveBeenCalledWith(
      1,
      "session",
      "approval-denied",
      "deny",
      "recovered",
    );
  });

  it("continues with a removed-tool error for an allowed legacy process approval", async () => {
    const appendMessage = vi.fn(async () => undefined);
    const continueRun = vi.fn(async () => assistantMessage);
    const getTools = vi.fn(() => []);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage,
      continue: continueRun,
      getTools,
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const approval = {
      model: modelConfig,
      permissionMode: "request-approval" as const,
      userMessage: "Inspect host processes",
      payload: {
        approvalId: "approval-legacy-process",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "call-legacy-process",
        toolName: "processList" as never,
        input: {},
        reason: "process-inspection" as const,
        display: "host processes",
      },
    };
    resolveApproval.mockResolvedValue({ approval, live: false });

    await expect(
      service.resolveToolApproval({
        approvalId: approval.payload.approvalId,
        workspaceId: approval.payload.workspaceId,
        sessionId: approval.payload.sessionId,
        decision: "allow",
      }),
    ).resolves.toBe(true);

    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    expect(getTools).toHaveBeenCalledOnce();
    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "toolResult",
        toolCallId: "call-legacy-process",
        isError: true,
        content: [{ type: "text", text: "工具已移除：processList" }],
      }),
    );
  });

  it("bypasses AI in request-approval mode and denies aborted delegated reviews", async () => {
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);
    requestApproval.mockResolvedValue("deny");

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Run command",
      model: modelConfig,
    });
    const requestHandler = getAgentHarness.mock.calls.at(-1)?.[0].requestApproval;
    const toolRequest = {
      toolCallId: "call",
      toolName: "bash" as const,
      input: { command: "curl example.com" },
      reason: "sandbox-denied" as const,
      display: "curl example.com",
    };
    await expect(requestHandler?.(toolRequest)).resolves.toBe("deny");
    expect(review).not.toHaveBeenCalled();

    const controller = new AbortController();
    controller.abort();
    await expect(requestHandler?.(toolRequest, controller.signal)).resolves.toBe("deny");
  });

  it("validates prerequisites before creating a harness", async () => {
    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "  ",
        model: modelConfig,
      }),
    ).rejects.toThrow("text or an attachment");
    expect(getAgentHarness).not.toHaveBeenCalled();

    findById.mockReturnValueOnce(undefined);
    await expect(
      service.sendMessage({
        workspaceId: 99,
        sessionId: "session",
        content: "Hi",
        model: modelConfig,
      }),
    ).rejects.toThrow("Workspace not found");

    getModel.mockImplementationOnce(() => {
      throw new Error("Unsupported model");
    });
    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "Hi",
        model: { providerId: "openai", modelId: "missing" },
      }),
    ).rejects.toThrow("Unsupported model");
    expect(getAgentHarness).not.toHaveBeenCalled();
  });
});
