import "reflect-metadata";
import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { describe, expect, it, vi } from "vitest";
import { ResolveToolApprovalController } from "../src/main/controllers/message/resolve-tool-approval.message.controller";
import type { EventService } from "../src/main/service/event.service";
import type { MessageService } from "../src/main/service/message.service";
import type { SessionService } from "../src/main/service/session.service";
import {
  ToolApprovalService,
  type ToolApprovalRecoveryContext,
} from "../src/main/service/tool-approval.service";
import { TOOL_APPROVAL_EVENT, TOOL_APPROVAL_RESOLVED_EVENT } from "../src/shared/constants";

const recovery: ToolApprovalRecoveryContext = {
  model: { providerId: "openai", modelId: "large" },
  permissionMode: "request-approval",
  userMessage: "Run the requested command",
};

function createApprovalServices() {
  const entries: SessionTreeEntry[] = [];
  const sendEvent = vi.fn<EventService["sendEvent"]>();
  const appendCustomEntry = vi.fn<SessionService["appendCustomEntry"]>(
    async (_workspaceId, _sessionId, customType, data) => {
      const parentId = entries.at(-1)?.id ?? null;
      await Promise.resolve();
      const entryId = `entry-${entries.length + 1}`;
      entries.push({
        type: "custom",
        id: entryId,
        parentId,
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
    getBranch,
    sendEvent,
    sessionService,
    service: new ToolApprovalService({ sendEvent } as unknown as EventService, sessionService),
  };
}

function getApprovalEvents(sendEvent: ReturnType<typeof vi.fn<EventService["sendEvent"]>>) {
  return sendEvent.mock.calls
    .filter(([event]) => event === TOOL_APPROVAL_EVENT)
    .map(([, payload]) => payload);
}

describe("ToolApprovalService", () => {
  it("persists requests before serializing and resolving each decision once", async () => {
    const { appendCustomEntry, entries, sendEvent, service } = createApprovalServices();
    const request = {
      toolCallId: "call",
      toolName: "bash" as const,
      input: { command: "echo ok" },
      reason: "sandbox-denied" as const,
      display: "echo ok",
    };

    const first = service.request(1, "session", request, recovery);
    const second = service.request(1, "session", { ...request, toolCallId: "second" }, recovery);
    await vi.waitFor(() => expect(getApprovalEvents(sendEvent)).toHaveLength(1));
    await vi.waitFor(() => expect(entries).toHaveLength(2));
    expect(entries[1]?.parentId).toBe(entries[0]?.id);
    expect(appendCustomEntry).toHaveBeenNthCalledWith(
      1,
      1,
      "session",
      "willow.tool-approval",
      expect.objectContaining({ type: "requested" }),
    );
    const firstPayload = getApprovalEvents(sendEvent)[0]!;
    expect(sendEvent).toHaveBeenCalledWith(
      TOOL_APPROVAL_EVENT,
      expect.objectContaining({ workspaceId: 1, sessionId: "session" }),
    );

    await expect(service.resolve(1, "session", firstPayload.approvalId, "allow")).resolves.toEqual(
      expect.objectContaining({ live: true }),
    );
    await expect(first).resolves.toBe("allow");
    await vi.waitFor(() => expect(getApprovalEvents(sendEvent)).toHaveLength(2));
    const secondPayload = getApprovalEvents(sendEvent)[1]!;
    await expect(service.resolve(1, "session", secondPayload.approvalId, "deny")).resolves.toEqual(
      expect.objectContaining({ live: true }),
    );
    await expect(second).resolves.toBe("deny");
    await expect(
      service.resolve(1, "session", secondPayload.approvalId, "allow"),
    ).resolves.toBeUndefined();
  });

  it("resolves the displayed approval when concurrent persistence completes out of order", async () => {
    const { entries, sendEvent, service } = createApprovalServices();
    const request = {
      toolCallId: "first-webfetch",
      toolName: "webfetch" as const,
      input: { url: "https://first.example.com" },
      reason: "network-domain" as const,
      display: "first.example.com",
    };

    const first = service.request(1, "session", request, recovery);
    const second = service.request(
      1,
      "session",
      {
        ...request,
        toolCallId: "second-webfetch",
        input: { url: "https://second.example.com" },
        display: "second.example.com",
      },
      recovery,
    );
    await vi.waitFor(() => expect(getApprovalEvents(sendEvent)).toHaveLength(1));
    const firstPayload = getApprovalEvents(sendEvent)[0]!;

    entries.reverse();

    await expect(service.resolve(1, "session", firstPayload.approvalId, "allow")).resolves.toEqual(
      expect.objectContaining({ live: true }),
    );
    await expect(first).resolves.toBe("allow");
    await vi.waitFor(() => expect(getApprovalEvents(sendEvent)).toHaveLength(2));
    const secondPayload = getApprovalEvents(sendEvent)[1]!;
    await expect(service.resolve(1, "session", secondPayload.approvalId, "deny")).resolves.toEqual(
      expect.objectContaining({ live: true }),
    );
    await expect(second).resolves.toBe("deny");
  });

  it("denies and removes an approval when the run aborts", async () => {
    const { sendEvent, service } = createApprovalServices();
    const controller = new AbortController();
    const decision = service.request(
      1,
      "session",
      {
        toolCallId: "call",
        toolName: "write",
        input: { path: "/outside" },
        reason: "outside-workspace-write",
        display: "/outside",
      },
      recovery,
      controller.signal,
    );
    await vi.waitFor(() => expect(sendEvent).toHaveBeenCalledOnce());
    const payload = sendEvent.mock.calls[0]![1];

    controller.abort();
    await expect(decision).resolves.toBe("deny");
    expect(sendEvent).toHaveBeenCalledWith(
      TOOL_APPROVAL_RESOLVED_EVENT,
      expect.objectContaining({ approvalId: payload.approvalId }),
    );
    await expect(
      service.resolve(1, "session", payload.approvalId, "allow"),
    ).resolves.toBeUndefined();
  });

  it("includes an AI review in the persisted user fallback event", async () => {
    const { sendEvent, service } = createApprovalServices();
    const review = { status: "rejected" as const, reason: "The operation is too broad." };

    void service.request(
      1,
      "session",
      {
        toolCallId: "call",
        toolName: "bash",
        input: { command: "rm -rf /" },
        reason: "sandbox-denied",
        display: "rm -rf /",
      },
      recovery,
      undefined,
      review,
    );

    await vi.waitFor(() =>
      expect(sendEvent).toHaveBeenCalledWith(
        TOOL_APPROVAL_EVENT,
        expect.objectContaining({ aiReview: review }),
      ),
    );
  });

  it("recovers an unresolved approval from a new service instance", async () => {
    const state = createApprovalServices();
    void state.service.request(
      1,
      "session",
      {
        toolCallId: "recover-call",
        toolName: "read",
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read",
        display: "/outside/file.txt",
      },
      recovery,
    );
    await vi.waitFor(() => expect(state.sendEvent).toHaveBeenCalledOnce());
    const approvalId = state.sendEvent.mock.calls[0]![1].approvalId;
    const recoveredService = new ToolApprovalService(
      { sendEvent: vi.fn() } as unknown as EventService,
      state.sessionService,
    );

    await expect(recoveredService.getPendingApproval(1, "session")).resolves.toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ approvalId, toolCallId: "recover-call" }),
      }),
    );
    await expect(recoveredService.resolve(1, "session", approvalId, "allow")).resolves.toEqual(
      expect.objectContaining({ live: false }),
    );
    await expect(recoveredService.getPendingApproval(1, "session")).resolves.toBeUndefined();
  });

  it("recovers an in-memory approval after its original task disconnects", async () => {
    const state = createApprovalServices();
    const decision = state.service.request(
      1,
      "session",
      {
        toolCallId: "disconnected-call",
        toolName: "read",
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read",
        display: "/outside/file.txt",
      },
      recovery,
    );
    await vi.waitFor(() => expect(state.sendEvent).toHaveBeenCalledOnce());
    const approvalId = state.sendEvent.mock.calls[0]![1].approvalId;

    await expect(
      state.service.resolve(1, "session", approvalId, "allow", "recovered"),
    ).resolves.toEqual(expect.objectContaining({ live: false }));
    await expect(decision).resolves.toBe("allow");
    await expect(state.service.getPendingApproval(1, "session")).resolves.toBeUndefined();
  });
});

describe("ResolveToolApprovalController", () => {
  it("validates input and delegates valid decisions", async () => {
    const resolveToolApproval = vi.fn(async () => true);
    const controller = new ResolveToolApprovalController({
      resolveToolApproval,
    } as unknown as MessageService);
    const event = undefined as unknown as Electron.IpcMainInvokeEvent;
    const request = {
      approvalId: "approval",
      workspaceId: 1,
      sessionId: "session",
      decision: "allow" as const,
    };

    await expect(controller.run(event, request)).resolves.toEqual({
      code: 0,
      data: { resolved: true },
      msg: "ok",
    });
    expect(resolveToolApproval).toHaveBeenCalledWith(request);
    await expect(controller.run(event, { ...request, approvalId: "" })).resolves.toEqual({
      code: 400,
      msg: "approvalId must be a non-empty string",
    });
  });
});
