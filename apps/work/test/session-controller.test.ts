import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateSessionController } from "../src/main/controllers/session/create.session.controller";
import { GetSessionListController } from "../src/main/controllers/session/get-list.session.controller";
import type { SessionService } from "../src/main/service/session.service";
import type { CreateSessionRequest, GetSessionListRequest } from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const createSession = vi.fn<SessionService["createSession"]>();
const getSessionList = vi.fn<SessionService["getSessionList"]>();
const sessionService = { createSession, getSessionList } as unknown as SessionService;
const createController = new CreateSessionController(sessionService);
const listController = new GetSessionListController(sessionService);

describe("create session controller", () => {
  beforeEach(() => {
    createSession.mockReset();
    getSessionList.mockReset();
  });

  it("creates a session and returns its agent session id", async () => {
    createSession.mockResolvedValueOnce({
      id: "new-session",
      createdAt: "2026-07-19T00:00:00.000Z",
      databaseId: 10,
      workspaceId: 1,
      title: "",
    });

    await expect(createController.run(event, { workspaceId: 1 })).resolves.toEqual({
      code: 0,
      data: { sessionId: "new-session" },
      msg: "ok",
    });
    expect(createSession).toHaveBeenCalledWith(1);
  });

  it.each([undefined, { workspaceId: 0 }, { workspaceId: -1 }, { workspaceId: 1.5 }])(
    "rejects an invalid workspace id without creating a session",
    async (request) => {
      const response = await createController.run(event, request as CreateSessionRequest);

      expect(response.code).toBe(400);
      expect(createSession).not.toHaveBeenCalled();
    },
  );

  it("propagates session service failures", async () => {
    const error = new Error("create failed");
    createSession.mockRejectedValueOnce(error);

    await expect(createController.run(event, { workspaceId: 1 })).rejects.toBe(error);
  });
});

describe("get session list controller", () => {
  beforeEach(() => {
    createSession.mockReset();
    getSessionList.mockReset();
  });

  it("returns public session information for a workspace", async () => {
    getSessionList.mockResolvedValueOnce([
      {
        id: "session-1",
        createdAt: "2026-07-20T00:00:00.000Z",
        databaseId: 10,
        workspaceId: 1,
        title: "First session",
      },
    ]);

    await expect(listController.run(event, { workspaceId: 1 })).resolves.toEqual({
      code: 0,
      data: {
        sessions: [
          {
            id: "session-1",
            createdAt: "2026-07-20T00:00:00.000Z",
            workspaceId: 1,
            title: "First session",
          },
        ],
      },
      msg: "ok",
    });
    expect(getSessionList).toHaveBeenCalledWith(1);
  });

  it.each([undefined, { workspaceId: 0 }, { workspaceId: -1 }, { workspaceId: 1.5 }])(
    "rejects an invalid workspace id without listing sessions",
    async (request) => {
      const response = await listController.run(event, request as GetSessionListRequest);

      expect(response.code).toBe(400);
      expect(getSessionList).not.toHaveBeenCalled();
    },
  );

  it("propagates session service failures", async () => {
    const error = new Error("list failed");
    getSessionList.mockRejectedValueOnce(error);

    await expect(listController.run(event, { workspaceId: 1 })).rejects.toBe(error);
  });
});
