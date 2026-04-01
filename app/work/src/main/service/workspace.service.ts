import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import { Injectable } from "@willow/poetry";
import { app } from "electron";
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceDao: WorkspaceDao,
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
  ) {}

  generateWorkspaceId() {
    return Date.now();
  }

  async createDefaultWorkspace(name: string) {
    // 生成一个 ID
    const id = this.generateWorkspaceId();
    const workspacePath = join(app.getPath("userData"), "workspace", id.toString());
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
    const sessions = this.sessionDao.findByWorkspaceId(id);
    const sessionIds = sessions.map((s) => s.id);
    this.sessionMessageDao.deleteBySessionIds(sessionIds);
    this.sessionDao.deleteByWorkspaceId(id);
    return this.workspaceDao.deleteById(id);
  }

  async getWorkspaceInfo(id: number) {
    return this.workspaceDao.findById(id);
  }

  async renameWorkspace(id: number, name: string) {
    return this.workspaceDao.update(id, { name });
  }
}
