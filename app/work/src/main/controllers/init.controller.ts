import { Injectable, IPC } from "@willow/poetry";
import { WorkspaceService } from "@main/service/workspace.service";
import { INIT, INIT_PROGRESS, INIT_WORKSPACE } from "@shared/index";

@Injectable()
export class InitController {
  private isInitialized: boolean = false;
  private workspacePath: string;
  private baseStartPath: string;

  constructor(private readonly workspaceService: WorkspaceService) {}

  @IPC(INIT)
  async init(event: Electron.IpcMainInvokeEvent) {
    if (this.isInitialized) {
      event.sender.send(INIT_WORKSPACE, {
        data: {
          workspacePath: this.workspacePath,
          baseStartPath: this.baseStartPath,
        },
      });
      return;
    }
    // 开始初始化
    event.sender.send(INIT_PROGRESS, {
      data: "初始化 workspace",
    });

    const { workspacePath, baseStartPath } =
      await this.workspaceService.initWorkspace();
    this.workspacePath = workspacePath;
    this.baseStartPath = baseStartPath;
    // 初始化工作空间成功，返回工作空间路径
    event.sender.send(INIT_WORKSPACE, {
      data: {
        workspacePath,
        baseStartPath,
      },
    });

    this.isInitialized = true;
  }
}
