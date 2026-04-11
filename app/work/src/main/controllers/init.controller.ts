import { AutomationService } from "@main/service/automation.service";
import { DbService } from "@main/service/db.service";
import { WorkspaceService } from "@main/service/workspace.service";
import { Injectable } from "@willow/poetry";

@Injectable()
export class InitController {
  private isInitialized: boolean = false;

  constructor(
    private readonly dbService: DbService,
    private readonly workspaceService: WorkspaceService,
    private readonly automationService: AutomationService,
  ) {}

  async init() {
    if (this.isInitialized) {
      return;
    }

    this.dbService.init();

    const workspaceList = await this.workspaceService.getWorkspaceList();
    if (workspaceList.length === 0) {
      await this.workspaceService.createDefaultWorkspace("默认工作空间");
    }

    await this.automationService.restoreSchedules();

    this.isInitialized = true;
  }
}
