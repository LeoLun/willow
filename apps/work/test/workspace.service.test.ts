import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "../src/main/db/schema";
import type { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import {
  WorkspaceNotFoundError,
  WorkspacePathConflictError,
  WorkspaceService,
} from "../src/main/service/workspace.service";

const workspace: Workspace = {
  id: 1,
  name: "Willow",
  path: "/workspace/willow",
  pinned: false,
  createdAt: new Date("2026-07-17T00:00:00.000Z"),
  updatedAt: new Date("2026-07-17T00:00:00.000Z"),
};

const findAll = vi.fn<WorkspaceDao["findAll"]>();
const findById = vi.fn<WorkspaceDao["findById"]>();
const findByPath = vi.fn<WorkspaceDao["findByPath"]>();
const create = vi.fn<WorkspaceDao["create"]>();
const update = vi.fn<WorkspaceDao["update"]>();
const deleteWorkspace = vi.fn<WorkspaceDao["delete"]>();
const workspaceDao = {
  findAll,
  findById,
  findByPath,
  create,
  update,
  delete: deleteWorkspace,
} as unknown as WorkspaceDao;
const service = new WorkspaceService(workspaceDao);

describe("WorkspaceService", () => {
  beforeEach(() => {
    findAll.mockReset();
    findById.mockReset();
    findByPath.mockReset();
    create.mockReset();
    update.mockReset();
    deleteWorkspace.mockReset();
  });

  it("returns the workspace list in DAO order", () => {
    findAll.mockReturnValueOnce([workspace]);

    expect(service.getWorkspaceList(false)).toEqual([workspace]);
    expect(findAll).toHaveBeenCalledWith(false);
  });

  it("creates a workspace when its path is unused", () => {
    findByPath.mockReturnValueOnce(undefined);
    create.mockReturnValueOnce(workspace);

    expect(service.createWorkspace(workspace.name, workspace.path)).toEqual(workspace);
    expect(findByPath).toHaveBeenCalledWith(workspace.path);
    expect(create).toHaveBeenCalledWith({ name: workspace.name, path: workspace.path });
  });

  it("rejects a duplicate path without creating a workspace", () => {
    findByPath.mockReturnValueOnce(workspace);

    expect(() => service.createWorkspace("Duplicate", workspace.path)).toThrow(
      WorkspacePathConflictError,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("returns workspace details", () => {
    findById.mockReturnValueOnce(workspace);

    expect(service.getWorkspaceDetail(workspace.id)).toEqual(workspace);
    expect(findById).toHaveBeenCalledWith(workspace.id);
  });

  it("updates the workspace pinned state", () => {
    const pinnedWorkspace = { ...workspace, pinned: true };
    update.mockReturnValueOnce(pinnedWorkspace);

    expect(service.setWorkspacePinned(workspace.id, true)).toEqual(pinnedWorkspace);
    expect(update).toHaveBeenCalledWith(workspace.id, { pinned: true });
  });

  it("renames a workspace", () => {
    const renamedWorkspace = { ...workspace, name: "Renamed Willow" };
    update.mockReturnValueOnce(renamedWorkspace);

    expect(service.renameWorkspace(workspace.id, renamedWorkspace.name)).toEqual(renamedWorkspace);
    expect(update).toHaveBeenCalledWith(workspace.id, { name: renamedWorkspace.name });
  });

  it("reports a missing workspace when renaming", () => {
    update.mockReturnValueOnce(undefined);

    expect(() => service.renameWorkspace(99, "Renamed Willow")).toThrow(WorkspaceNotFoundError);
  });

  it("propagates DAO failures when renaming", () => {
    const error = new Error("database failed");
    update.mockImplementationOnce(() => {
      throw error;
    });

    expect(() => service.renameWorkspace(workspace.id, "Renamed Willow")).toThrow(error);
  });

  it("reports a missing workspace when updating the pinned state", () => {
    update.mockReturnValueOnce(undefined);

    expect(() => service.setWorkspacePinned(99, true)).toThrow(WorkspaceNotFoundError);
  });

  it("reports a missing workspace detail", () => {
    findById.mockReturnValueOnce(undefined);

    expect(() => service.getWorkspaceDetail(99)).toThrow(WorkspaceNotFoundError);
  });

  it("deletes an existing workspace", () => {
    deleteWorkspace.mockReturnValueOnce(true);

    expect(service.deleteWorkspace(workspace.id)).toBeUndefined();
    expect(deleteWorkspace).toHaveBeenCalledWith(workspace.id);
  });

  it("reports a missing workspace deletion", () => {
    deleteWorkspace.mockReturnValueOnce(false);

    expect(() => service.deleteWorkspace(99)).toThrow(WorkspaceNotFoundError);
  });

  it("propagates DAO failures", () => {
    const error = new Error("database failed");
    findAll.mockImplementationOnce(() => {
      throw error;
    });

    expect(() => service.getWorkspaceList(false)).toThrow(error);
  });
});
