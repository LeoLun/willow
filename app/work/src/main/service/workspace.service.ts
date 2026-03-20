import { Injectable } from "@willow/poetry";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { app } from "electron";
@Injectable()
export class WorkspaceService {
  constructor(private readonly workspaceDao: WorkspaceDao) {}

  generateWorkspaceId() {
    return Date.now();
  }

  async createDefaultWorkspace(name: string) {
    // 生成一个 ID
    const id = this.generateWorkspaceId();
    const workspacePath = join(
      app.getPath("userData"),
      "workspace",
      id.toString(),
    );
    await mkdir(workspacePath, { recursive: true });
    return this.workspaceDao.insert({ name, path: workspacePath, id });
  }

  async getWorkspaceList() {
    return this.workspaceDao.findAll();
  }

  async createWorkspace(name: string, path: string) {
    return this.workspaceDao.insert({ name, path });
  }

  async deleteWorkspace(id: number) {
    return this.workspaceDao.deleteById(id);
  }

  async getWorkspaceInfo(id: number) {
    return this.workspaceDao.findById(id);
  }
}
