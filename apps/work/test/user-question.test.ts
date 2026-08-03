import "reflect-metadata";
import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import type { AskUserRequest } from "@willow/core";
import { describe, expect, it, vi } from "vitest";
import { ResolveUserQuestionController } from "../src/main/controllers/message/resolve-user-question.message.controller";
import type { EventService } from "../src/main/service/event.service";
import type { MessageService } from "../src/main/service/message.service";
import type { SessionService } from "../src/main/service/session.service";
import {
  UserQuestionService,
  type UserQuestionRecoveryContext,
} from "../src/main/service/user-question.service";
import { USER_QUESTION_EVENT, USER_QUESTION_RESOLVED_EVENT } from "../src/shared/constants";

const recovery: UserQuestionRecoveryContext = {
  model: { providerId: "openai", modelId: "large" },
  permissionMode: "request-approval",
  userMessage: "Ask before choosing the scope",
};

const request: AskUserRequest = {
  toolCallId: "call",
  questions: [
    {
      header: "范围",
      question: "处理哪些内容？",
      options: [
        { label: "全部", description: "处理全部内容" },
        { label: "部分", description: "仅处理选中内容" },
      ],
    },
  ],
};

function createQuestionServices() {
  const entries: SessionTreeEntry[] = [];
  const sendEvent = vi.fn<EventService["sendEvent"]>();
  const appendCustomEntry = vi.fn<SessionService["appendCustomEntry"]>(
    async (_workspaceId, _sessionId, customType, data) => {
      const entryId = `entry-${entries.length + 1}`;
      entries.push({
        type: "custom",
        id: entryId,
        parentId: entries.at(-1)?.id ?? null,
        timestamp: Date.now(),
        customType,
        data,
      } as SessionTreeEntry);
      return entryId;
    },
  );
  const getBranch = vi.fn<SessionService["getBranch"]>(async () => entries);
  const sessionService = { appendCustomEntry, getBranch } as unknown as SessionService;
  return {
    appendCustomEntry,
    entries,
    sendEvent,
    sessionService,
    service: new UserQuestionService({ sendEvent } as unknown as EventService, sessionService),
  };
}

function getQuestionEvents(sendEvent: ReturnType<typeof vi.fn<EventService["sendEvent"]>>) {
  return sendEvent.mock.calls
    .filter(([event]) => event === USER_QUESTION_EVENT)
    .map(([, payload]) => payload);
}

describe("UserQuestionService", () => {
  it("persists, serializes, and resolves questions", async () => {
    const state = createQuestionServices();
    const first = state.service.request(1, "session", request, recovery);
    const second = state.service.request(
      1,
      "session",
      { ...request, toolCallId: "second-call" },
      recovery,
    );
    await vi.waitFor(() => expect(getQuestionEvents(state.sendEvent)).toHaveLength(1));
    expect(state.appendCustomEntry).toHaveBeenNthCalledWith(
      1,
      1,
      "session",
      "willow.user-question",
      expect.objectContaining({ type: "requested" }),
    );

    const firstPayload = getQuestionEvents(state.sendEvent)[0]!;
    await expect(
      state.service.resolve(1, "session", firstPayload.requestId, {
        "处理哪些内容？": ["全部"],
      }),
    ).resolves.toEqual(expect.objectContaining({ live: true }));
    await expect(first).resolves.toEqual({ "处理哪些内容？": ["全部"] });
    await vi.waitFor(() => expect(getQuestionEvents(state.sendEvent)).toHaveLength(2));

    const secondPayload = getQuestionEvents(state.sendEvent)[1]!;
    await expect(state.service.resolve(1, "session", secondPayload.requestId)).resolves.toEqual(
      expect.objectContaining({ live: true }),
    );
    await expect(second).resolves.toBeUndefined();
    await expect(
      state.service.resolve(1, "session", secondPayload.requestId),
    ).resolves.toBeUndefined();
  });

  it("persists dismissal when the run aborts", async () => {
    const state = createQuestionServices();
    const controller = new AbortController();
    const pending = state.service.request(1, "session", request, recovery, controller.signal);
    await vi.waitFor(() => expect(state.sendEvent).toHaveBeenCalledOnce());
    const payload = state.sendEvent.mock.calls[0]![1];

    controller.abort();
    await expect(pending).resolves.toBeUndefined();
    expect(state.sendEvent).toHaveBeenCalledWith(
      USER_QUESTION_RESOLVED_EVENT,
      expect.objectContaining({ requestId: payload.requestId }),
    );
    await expect(state.service.getPendingQuestion(1, "session")).resolves.toBeUndefined();
  });

  it("rejects incomplete, repeated, and cross-session answers", async () => {
    const state = createQuestionServices();
    const pending = state.service.request(1, "owner", request, recovery);
    await vi.waitFor(() => expect(state.sendEvent).toHaveBeenCalledOnce());
    const payload = getQuestionEvents(state.sendEvent)[0]!;

    await expect(state.service.resolve(1, "other", payload.requestId, {})).resolves.toBeUndefined();
    await expect(state.service.resolve(1, "owner", payload.requestId, {})).resolves.toBeUndefined();
    await expect(
      state.service.resolve(1, "owner", payload.requestId, {
        "处理哪些内容？": ["全部", "全部"],
      }),
    ).resolves.toBeUndefined();
    await expect(
      state.service.resolve(1, "owner", payload.requestId, {
        "处理哪些内容？": ["全部"],
      }),
    ).resolves.toEqual(expect.objectContaining({ live: true }));
    await pending;
  });

  it("recovers an unresolved question from a new service instance", async () => {
    const state = createQuestionServices();
    void state.service.request(1, "session", request, recovery);
    await vi.waitFor(() => expect(state.sendEvent).toHaveBeenCalledOnce());
    const requestId = getQuestionEvents(state.sendEvent)[0]!.requestId;
    const recoveredService = new UserQuestionService(
      { sendEvent: vi.fn() } as unknown as EventService,
      state.sessionService,
    );

    await expect(recoveredService.getPendingQuestion(1, "session")).resolves.toEqual(
      expect.objectContaining({
        model: recovery.model,
        payload: expect.objectContaining({ requestId, toolCallId: "call" }),
      }),
    );
    await expect(
      recoveredService.resolve(
        1,
        "session",
        requestId,
        { "处理哪些内容？": ["全部"] },
        "recovered",
      ),
    ).resolves.toEqual(expect.objectContaining({ live: false }));
    await expect(recoveredService.getPendingQuestion(1, "session")).resolves.toBeUndefined();
  });
});

describe("ResolveUserQuestionController", () => {
  it("validates input and delegates valid answers", async () => {
    const resolveUserQuestion = vi.fn(async () => true);
    const controller = new ResolveUserQuestionController({
      resolveUserQuestion,
    } as unknown as MessageService);
    const event = undefined as unknown as Electron.IpcMainInvokeEvent;
    const input = {
      requestId: "question",
      workspaceId: 1,
      sessionId: "session",
      answers: { "处理哪些内容？": ["全部"] },
    };

    await expect(controller.run(event, input)).resolves.toEqual({
      code: 0,
      data: { resolved: true },
      msg: "ok",
    });
    expect(resolveUserQuestion).toHaveBeenCalledWith(input);
    await expect(controller.run(event, { ...input, requestId: "" })).resolves.toEqual({
      code: 400,
      msg: "requestId must be a non-empty string",
    });
  });
});
