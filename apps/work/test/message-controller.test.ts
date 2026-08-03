import "reflect-metadata";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetMessageListController } from "../src/main/controllers/message/get-list.message.controller";
import { SendMessageController } from "../src/main/controllers/message/send.message.controller";
import { StopMessageController } from "../src/main/controllers/message/stop.message.controller";
import type { MessageService } from "../src/main/service/message.service";
import type {
  GetMessageListRequest,
  SendMessageRequest,
  StopMessageRequest,
} from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const sendMessage = vi.fn<MessageService["sendMessage"]>();
const stopMessage = vi.fn<MessageService["stopMessage"]>();
const getMessageList = vi.fn<MessageService["getMessageList"]>();
const messageService = {
  sendMessage,
  stopMessage,
  getMessageList,
} as unknown as MessageService;
const sendController = new SendMessageController(messageService);
const stopController = new StopMessageController(messageService);
const listController = new GetMessageListController(messageService);

describe("message controllers", () => {
  beforeEach(() => {
    sendMessage.mockReset();
    stopMessage.mockReset();
    getMessageList.mockReset();
  });

  it("sends a message and returns the final assistant response", async () => {
    const request: SendMessageRequest = {
      workspaceId: 1,
      sessionId: "session",
      content: "Hello",
      model: { providerId: "openai", modelId: "large" },
    };
    const message = { role: "assistant", content: [] } as unknown as AssistantMessage;
    sendMessage.mockResolvedValueOnce(message);

    await expect(sendController.run(event, request)).resolves.toEqual({
      code: 0,
      data: { message },
      msg: "ok",
    });
    expect(sendMessage).toHaveBeenCalledWith(request);
  });

  it("stops the active message run and reports whether anything was stopped", async () => {
    stopMessage.mockResolvedValueOnce(true);

    await expect(
      stopController.run(event, { workspaceId: 1, sessionId: "session" }),
    ).resolves.toEqual({ code: 0, data: { stopped: true }, msg: "ok" });
    expect(stopMessage).toHaveBeenCalledWith(1, "session");
  });

  it("returns the current session message list", async () => {
    const messages: AgentMessage[] = [{ role: "user", content: "Hello", timestamp: 1 }];
    getMessageList.mockResolvedValueOnce({ messages });

    await expect(
      listController.run(event, { workspaceId: 1, sessionId: "session" }),
    ).resolves.toEqual({ code: 0, data: { messages }, msg: "ok" });
    expect(getMessageList).toHaveBeenCalledWith(1, "session");
  });

  it.each([
    undefined,
    { workspaceId: 0, sessionId: "session" },
    { workspaceId: 1.5, sessionId: "session" },
    { workspaceId: 1, sessionId: "   " },
  ])("rejects invalid session parameters without calling the service", async (request) => {
    const sendRequest = request
      ? { ...request, content: "Hello", model: { providerId: "openai", modelId: "large" } }
      : (request as unknown as SendMessageRequest);

    expect((await sendController.run(event, sendRequest as SendMessageRequest)).code).toBe(400);
    expect((await stopController.run(event, request as StopMessageRequest)).code).toBe(400);
    expect((await listController.run(event, request as GetMessageListRequest)).code).toBe(400);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(stopMessage).not.toHaveBeenCalled();
    expect(getMessageList).not.toHaveBeenCalled();
  });

  it("rejects a message without text or attachments", async () => {
    await expect(
      sendController.run(event, {
        workspaceId: 1,
        sessionId: "session",
        content: "  ",
        model: { providerId: "openai", modelId: "large" },
      }),
    ).resolves.toEqual({ code: 400, msg: "message must include text or an attachment" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("allows an attachment-only message", async () => {
    const message = { role: "assistant", content: [] } as unknown as AssistantMessage;
    sendMessage.mockResolvedValueOnce(message);
    const request: SendMessageRequest = {
      workspaceId: 1,
      sessionId: "session",
      content: "",
      model: { providerId: "openai", modelId: "large" },
      attachments: [
        {
          path: "/tmp/photo.png",
          name: "photo.png",
          fileType: "PNG",
          mimeType: "image/png",
        },
      ],
    };

    await expect(sendController.run(event, request)).resolves.toEqual({
      code: 0,
      data: { message },
      msg: "ok",
    });
    expect(sendMessage).toHaveBeenCalledWith(request);
  });

  it("rejects an invalid model without calling the service", async () => {
    await expect(
      sendController.run(event, {
        workspaceId: 1,
        sessionId: "session",
        content: "Hello",
        model: { providerId: "", modelId: "large" },
      }),
    ).resolves.toEqual({
      code: 400,
      msg: "model must include non-empty providerId and modelId",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("rejects an invalid approval mode without calling the service", async () => {
    await expect(
      sendController.run(event, {
        workspaceId: 1,
        sessionId: "session",
        content: "Hello",
        model: { providerId: "openai", modelId: "large" },
        approvalMode: "invalid" as never,
      }),
    ).resolves.toEqual({
      code: 400,
      msg: "approvalMode must be a supported permission mode",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("rejects malformed attachments without calling the service", async () => {
    await expect(
      sendController.run(event, {
        workspaceId: 1,
        sessionId: "session",
        content: "Hello",
        model: { providerId: "openai", modelId: "large" },
        attachments: [{ path: "", name: "file", fileType: "TXT" }],
      }),
    ).resolves.toEqual({ code: 400, msg: "attachments must contain valid local files" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("propagates message service failures", async () => {
    const sendError = new Error("send failed");
    const stopError = new Error("stop failed");
    const listError = new Error("Session not found");
    sendMessage.mockRejectedValueOnce(sendError);
    stopMessage.mockRejectedValueOnce(stopError);
    getMessageList.mockRejectedValueOnce(listError);

    await expect(
      sendController.run(event, {
        workspaceId: 1,
        sessionId: "session",
        content: "Hello",
        model: { providerId: "openai", modelId: "large" },
      }),
    ).rejects.toBe(sendError);
    await expect(stopController.run(event, { workspaceId: 1, sessionId: "session" })).rejects.toBe(
      stopError,
    );
    await expect(listController.run(event, { workspaceId: 1, sessionId: "missing" })).rejects.toBe(
      listError,
    );
  });
});
