import { Injectable } from "@willow/poetry";
import { WorkspaceService } from "@main/service/workspace.service";
import { DbService } from "@main/service/db.service";

@Injectable()
export class InitController {
  private isInitialized: boolean = false;

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
    if (workspaceList.length === 0) {
      this.workspaceService.createDefaultWorkspace("默认工作空间");
    }
    this.isInitialized = true;
  }
}
