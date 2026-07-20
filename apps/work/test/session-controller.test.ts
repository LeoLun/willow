import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateSessionController } from "../src/main/controllers/session/create.session.controller";
import type { SessionService } from "../src/main/service/session.service";
import type { CreateSessionRequest } from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const createSession = vi.fn<SessionService["createSession"]>();
const sessionService = { createSession } as unknown as SessionService;
const controller = new CreateSessionController(sessionService);

describe("create session controller", () => {
  beforeEach(() => {
    createSession.mockReset();
  });

  it("creates a session and returns its agent session id", async () => {
    createSession.mockResolvedValueOnce({
      id: "new-session",
      createdAt: "2026-07-19T00:00:00.000Z",
      databaseId: 10,
      workspaceId: 1,
      title: "",
    });

    await expect(controller.run(event, { workspaceId: 1 })).resolves.toEqual({
      code: 0,
      data: { sessionId: "new-session" },
      msg: "ok",
    });
    expect(createSession).toHaveBeenCalledWith(1);
  });

  it.each([undefined, { workspaceId: 0 }, { workspaceId: -1 }, { workspaceId: 1.5 }])(
    "rejects an invalid workspace id without creating a session",
    async (request) => {
      const response = await controller.run(event, request as CreateSessionRequest);

      expect(response.code).toBe(400);
      expect(createSession).not.toHaveBeenCalled();
    },
  );

  it("propagates session service failures", async () => {
    const error = new Error("create failed");
    createSession.mockRejectedValueOnce(error);

    await expect(controller.run(event, { workspaceId: 1 })).rejects.toBe(error);
  });
});
