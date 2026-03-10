import { Injectable, IPC } from "@willow/poetry";
import { WorkspaceService } from "@main/service/workspace.service";
import { OpencodeService } from "@main/service/opencode.service";
import {
  INIT,
  INIT_PROGRESS,
  INIT_WORKSPACE,
  INIT_OPENCODE_SERVICE,
} from "@shared/index";

@Injectable()
export class InitController {
  private isInitialized: boolean = false;
  private workspacePath: string;
  private baseStartPath: string;

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly opencodeService: OpencodeService,
  ) {}

  @IPC(INIT)
  async init(event: Electron.IpcMainInvokeEvent) {
    if (this.isInitialized) {
      event.sender.send(INIT_WORKSPACE, {
        data: {
          workspacePath: this.workspacePath,
          baseStartPath: this.baseStartPath,
        },
      });
      event.sender.send(INIT_OPENCODE_SERVICE, {
        data: {
          url: this.opencodeService.getServerUrl(),
        },
      });
      event.sender.send(INIT_PROGRESS, {
        data: "初始化 opencode 服务成功",
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

    // 开始初始化 opencode 服务
    event.sender.send(INIT_PROGRESS, {
      message: "初始化 opencode 服务",
    });

    // 启动 opencode 服务
    await this.opencodeService.start();

    // 初始化 opencode 服务成功，返回 opencode 服务地址
    event.sender.send(INIT_OPENCODE_SERVICE, {
      data: {
        url: this.opencodeService.getServerUrl(),
      },
    });

    event.sender.send(INIT_PROGRESS, {
      data: "初始化 opencode 服务成功",
    });
    this.isInitialized = true;
  }
}
