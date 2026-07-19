import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateWorkspaceController } from "../src/main/controllers/workspace/create.workspace.controller";
import { DeleteWorkspaceController } from "../src/main/controllers/workspace/delete.workspace.controller";
import { GetWorkspaceDetailController } from "../src/main/controllers/workspace/get-detail.workspace.controller";
import { GetWorkspaceListController } from "../src/main/controllers/workspace/get-list.workspace.controller";
import { RenameWorkspaceController } from "../src/main/controllers/workspace/rename.workspace.controller";
import { SetWorkspacePinnedController } from "../src/main/controllers/workspace/set-pinned.workspace.controller";
import {
  WorkspaceNotFoundError,
  WorkspacePathConflictError,
  type WorkspaceService,
} from "../src/main/service/workspace.service";
import type {
  CreateWorkspaceRequest,
  DeleteWorkspaceRequest,
  GetWorkspaceDetailRequest,
  GetWorkspaceListRequest,
  RenameWorkspaceRequest,
  SetWorkspacePinnedRequest,
  WorkspaceInfo,
} from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const workspace: WorkspaceInfo = {
  id: 1,
  name: "Willow",
  path: "/workspace/willow",
  pinned: false,
  createdAt: new Date("2026-07-17T00:00:00.000Z"),
  updatedAt: new Date("2026-07-17T00:00:00.000Z"),
};

const getWorkspaceList = vi.fn<WorkspaceService["getWorkspaceList"]>();
const createWorkspace = vi.fn<WorkspaceService["createWorkspace"]>();
const getWorkspaceDetail = vi.fn<WorkspaceService["getWorkspaceDetail"]>();
const deleteWorkspace = vi.fn<WorkspaceService["deleteWorkspace"]>();
const renameWorkspace = vi.fn<WorkspaceService["renameWorkspace"]>();
const setWorkspacePinned = vi.fn<WorkspaceService["setWorkspacePinned"]>();
const workspaceService = {
  getWorkspaceList,
  createWorkspace,
  getWorkspaceDetail,
  deleteWorkspace,
  renameWorkspace,
  setWorkspacePinned,
} as unknown as WorkspaceService;

const listController = new GetWorkspaceListController(workspaceService);
const createController = new CreateWorkspaceController(workspaceService);
const detailController = new GetWorkspaceDetailController(workspaceService);
const deleteController = new DeleteWorkspaceController(workspaceService);
const renameController = new RenameWorkspaceController(workspaceService);
const pinnedController = new SetWorkspacePinnedController(workspaceService);

describe("workspace controllers", () => {
  beforeEach(() => {
    getWorkspaceList.mockReset();
    createWorkspace.mockReset();
    getWorkspaceDetail.mockReset();
    deleteWorkspace.mockReset();
    renameWorkspace.mockReset();
    setWorkspacePinned.mockReset();
  });

  it("returns the workspace list", async () => {
    getWorkspaceList.mockReturnValueOnce([workspace]);

    await expect(listController.run(event, { pinned: false })).resolves.toEqual({
      code: 0,
      data: { workspaces: [workspace] },
      msg: "ok",
    });
    expect(getWorkspaceList).toHaveBeenCalledWith(false);
  });

  it("creates a workspace", async () => {
    createWorkspace.mockReturnValueOnce(workspace);

    await expect(
      createController.run(event, { name: workspace.name, path: workspace.path }),
    ).resolves.toEqual({ code: 0, data: { workspace }, msg: "ok" });
    expect(createWorkspace).toHaveBeenCalledWith(workspace.name, workspace.path);
  });

  it("returns workspace details", async () => {
    getWorkspaceDetail.mockReturnValueOnce(workspace);

    await expect(detailController.run(event, { workspaceId: workspace.id })).resolves.toEqual({
      code: 0,
      data: { workspace },
      msg: "ok",
    });
  });

  it("deletes a workspace", async () => {
    deleteWorkspace.mockReturnValueOnce(undefined);

    await expect(deleteController.run(event, { workspaceId: workspace.id })).resolves.toEqual({
      code: 0,
      data: {},
      msg: "ok",
    });
    expect(deleteWorkspace).toHaveBeenCalledWith(workspace.id);
  });

  it("updates the workspace pinned state", async () => {
    const pinnedWorkspace = { ...workspace, pinned: true };
    setWorkspacePinned.mockReturnValueOnce(pinnedWorkspace);

    await expect(
      pinnedController.run(event, { workspaceId: workspace.id, pinned: true }),
    ).resolves.toEqual({ code: 0, data: { workspace: pinnedWorkspace }, msg: "ok" });
    expect(setWorkspacePinned).toHaveBeenCalledWith(workspace.id, true);
  });

  it("renames a workspace with a trimmed name", async () => {
    const renamedWorkspace = { ...workspace, name: "Renamed Willow" };
    renameWorkspace.mockReturnValueOnce(renamedWorkspace);

    await expect(
      renameController.run(event, { workspaceId: workspace.id, name: "  Renamed Willow  " }),
    ).resolves.toEqual({ code: 0, data: { workspace: renamedWorkspace }, msg: "ok" });
    expect(renameWorkspace).toHaveBeenCalledWith(workspace.id, renamedWorkspace.name);
  });

  it.each([undefined, {}, { pinned: "true" }])(
    "rejects invalid workspace list parameters without calling the service",
    async (request) => {
      expect((await listController.run(event, request as GetWorkspaceListRequest)).code).toBe(400);
      expect(getWorkspaceList).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, { name: "", path: "/workspace/willow" }, { name: "Willow", path: "   " }])(
    "rejects invalid create parameters without calling the service",
    async (request) => {
      expect((await createController.run(event, request as CreateWorkspaceRequest)).code).toBe(400);
      expect(createWorkspace).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, { workspaceId: 0 }, { workspaceId: 1.5 }])(
    "rejects invalid workspace ids without calling the service",
    async (request) => {
      expect((await detailController.run(event, request as GetWorkspaceDetailRequest)).code).toBe(
        400,
      );
      expect((await deleteController.run(event, request as DeleteWorkspaceRequest)).code).toBe(400);
      expect(getWorkspaceDetail).not.toHaveBeenCalled();
      expect(deleteWorkspace).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, { workspaceId: 0, pinned: true }, { workspaceId: 1, pinned: "true" }])(
    "rejects invalid pinned parameters without calling the service",
    async (request) => {
      expect((await pinnedController.run(event, request as SetWorkspacePinnedRequest)).code).toBe(
        400,
      );
      expect(setWorkspacePinned).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, { workspaceId: 0, name: "Renamed Willow" }, { workspaceId: 1, name: "   " }])(
    "rejects invalid rename parameters without calling the service",
    async (request) => {
      expect((await renameController.run(event, request as RenameWorkspaceRequest)).code).toBe(400);
      expect(renameWorkspace).not.toHaveBeenCalled();
    },
  );

  it("maps duplicate paths to a conflict response", async () => {
    createWorkspace.mockImplementationOnce(() => {
      throw new WorkspacePathConflictError(workspace.path);
    });

    await expect(
      createController.run(event, { name: workspace.name, path: workspace.path }),
    ).resolves.toEqual({ code: 409, msg: "Workspace path already exists" });
  });

  it("maps missing workspace details and deletions to not-found responses", async () => {
    getWorkspaceDetail.mockImplementationOnce(() => {
      throw new WorkspaceNotFoundError(99);
    });
    deleteWorkspace.mockImplementationOnce(() => {
      throw new WorkspaceNotFoundError(99);
    });

    await expect(detailController.run(event, { workspaceId: 99 })).resolves.toEqual({
      code: 404,
      msg: "Workspace not found",
    });
    await expect(deleteController.run(event, { workspaceId: 99 })).resolves.toEqual({
      code: 404,
      msg: "Workspace not found",
    });
  });

  it("maps a missing workspace pinned update to a not-found response", async () => {
    setWorkspacePinned.mockImplementationOnce(() => {
      throw new WorkspaceNotFoundError(99);
    });

    await expect(pinnedController.run(event, { workspaceId: 99, pinned: true })).resolves.toEqual({
      code: 404,
      msg: "Workspace not found",
    });
  });

  it("maps a missing workspace rename to a not-found response", async () => {
    renameWorkspace.mockImplementationOnce(() => {
      throw new WorkspaceNotFoundError(99);
    });

    await expect(
      renameController.run(event, { workspaceId: 99, name: "Renamed Willow" }),
    ).resolves.toEqual({ code: 404, msg: "Workspace not found" });
  });

  it("propagates unknown service failures", async () => {
    const listError = new Error("list failed");
    const createError = new Error("create failed");
    const detailError = new Error("detail failed");
    const deleteError = new Error("delete failed");
    const pinnedError = new Error("pinned failed");
    const renameError = new Error("rename failed");
    getWorkspaceList.mockImplementationOnce(() => {
      throw listError;
    });
    createWorkspace.mockImplementationOnce(() => {
      throw createError;
    });
    getWorkspaceDetail.mockImplementationOnce(() => {
      throw detailError;
    });
    deleteWorkspace.mockImplementationOnce(() => {
      throw deleteError;
    });
    setWorkspacePinned.mockImplementationOnce(() => {
      throw pinnedError;
    });
    renameWorkspace.mockImplementationOnce(() => {
      throw renameError;
    });

    await expect(listController.run(event, { pinned: false })).rejects.toBe(listError);
    await expect(
      createController.run(event, { name: workspace.name, path: workspace.path }),
    ).rejects.toBe(createError);
    await expect(detailController.run(event, { workspaceId: workspace.id })).rejects.toBe(
      detailError,
    );
    await expect(deleteController.run(event, { workspaceId: workspace.id })).rejects.toBe(
      deleteError,
    );
    await expect(
      pinnedController.run(event, { workspaceId: workspace.id, pinned: true }),
    ).rejects.toBe(pinnedError);
    await expect(
      renameController.run(event, { workspaceId: workspace.id, name: "Renamed Willow" }),
    ).rejects.toBe(renameError);
  });
});
