import { Injectable } from "poetry";
import { app } from "electron";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

@Injectable()
export class WorkspaceService {
  private workspacePath: string;
  private baseStartPath: string;

  // 初始化workspace
  async initWorkspace() {
    // 创建一个workspace目录（recursive: true 在目录已存在时不会报错）
    const workspacePath = join(app.getPath("userData"), "workspace");
    await mkdir(workspacePath, { recursive: true });

    // 初始化一个 start 目录
    const baseStartPath = join(workspacePath, "start");
    await mkdir(baseStartPath, { recursive: true });

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
