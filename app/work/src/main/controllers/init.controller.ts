import { Injectable, IPC } from "@willow/poetry";
import { WorkspaceService } from "@main/service/workspace.service";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { app } from "electron";
import { DbService } from "@main/service/db.service";

@Injectable()
export class InitController {
  private isInitialized: boolean = false;
  private workspacePath: string;
  private baseStartPath: string;

  constructor(
    private readonly dbService: DbService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async init() {
    if (this.isInitialized) {
      return;
    }

    this.dbService.init();

    // 检查是否存在 workspace 数据，如果不存在则创建基础 workspace 数据
    const workspaceList = await this.workspaceService.getWorkspaceList();
    console.log("workspaceList", workspaceList);
    if (workspaceList.length === 0) {
      this.workspaceService.createDefaultWorkspace("默认工作空间");
    }
    this.isInitialized = true;
  }
}
