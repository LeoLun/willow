import { Injectable } from "@willow/poetry";
import type { Workspace } from "../db/schema";
import { WorkspaceDao } from "./dao/workspace.dao.server";

export class WorkspaceNotFoundError extends Error {
  constructor(workspaceId: number) {
    super(`Workspace not found: ${workspaceId}`);
    this.name = "WorkspaceNotFoundError";
  }
}

export class WorkspacePathConflictError extends Error {
  constructor(path: string) {
    super(`Workspace path already exists: ${path}`);
    this.name = "WorkspacePathConflictError";
  }
}

/**
 * 用于管理 Workspace 的服务
 */
@Injectable()
export class WorkspaceService {
  constructor(private readonly workspaceDao: WorkspaceDao) {}

  getWorkspaceList(pinned: boolean): Workspace[] {
    return this.workspaceDao.findAll(pinned);
  }

  createWorkspace(name: string, path: string): Workspace {
    if (this.workspaceDao.findByPath(path)) {
      throw new WorkspacePathConflictError(path);
    }
    return this.workspaceDao.create({ name, path });
  }

  getWorkspaceDetail(workspaceId: number): Workspace {
    const workspace = this.workspaceDao.findById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }
    return workspace;
  }

  setWorkspacePinned(workspaceId: number, pinned: boolean): Workspace {
    const workspace = this.workspaceDao.update(workspaceId, { pinned });
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }
    return workspace;
  }

  renameWorkspace(workspaceId: number, name: string): Workspace {
    const workspace = this.workspaceDao.update(workspaceId, { name });
    if (!workspace) {
      throw new WorkspaceNotFoundError(workspaceId);
    }
    return workspace;
  }

  deleteWorkspace(workspaceId: number): void {
    if (!this.workspaceDao.delete(workspaceId)) {
      throw new WorkspaceNotFoundError(workspaceId);
    }
  }
}
