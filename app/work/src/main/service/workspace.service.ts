import { Injectable } from "poetry";
import { app } from "electron";
import { join } from "node:path";
import { mkdir, stat } from "node:fs/promises";

@Injectable()
export class WorkspaceService {
  private workspacePath: string;
  private baseStartPath: string;

  // 初始化workspace
  async initWorkspace() {
    // 创建一个workspace目录
    const workspacePath = join(app.getPath("userData"), "workspace");
    if (!(await stat(workspacePath)).isDirectory()) {
      await mkdir(workspacePath, { recursive: true });
    }

    // 初始化一个 start 目录
    const baseStartPath = join(workspacePath, "start");
    if (!(await stat(baseStartPath)).isDirectory()) {
      await mkdir(baseStartPath, { recursive: true });
    }
    this.workspacePath = workspacePath;
    this.baseStartPath = baseStartPath;
    return {
      workspacePath,
      baseStartPath,
    };
  }

  getWorkspacePath() {
    return this.workspacePath;
  }

  getBaseStartPath() {
    return this.baseStartPath;
  }
}
