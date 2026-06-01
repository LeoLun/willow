import { SessionService } from "@main/service/session.service";
import { WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  Session,
} from "@shared/api";
import { CREATE_WORKSPACE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class CreateWorkspaceController extends IPCBaseController<
  CreateWorkspaceRequest,
  CreateWorkspaceResponse
> {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly sessionService: SessionService,
  ) {
    super();
  }

  @IPC(CREATE_WORKSPACE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: CreateWorkspaceRequest,
  ): Promise<ApiResponse<CreateWorkspaceResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const workspace = request.path
      ? await this.workspaceService.createWorkspace(request.name, request.path, request.templateId)
      : await this.workspaceService.createDefaultWorkspace(request.name, request.templateId);

    let session: Session | undefined;
    let zipFileName: string | undefined;
    if (request.templateId) {
      const templates = await this.workspaceService.getWorkspaceTemplates();
      const template = templates.find((t) => t.id === request.templateId);
      if (template) {
        zipFileName = template.zipFileName;
      }
      session = await this.sessionService.createSession(workspace.id);
    }

    return this.buildResponse({ workspace, session, zipFileName });
  }

  checkParams(request: CreateWorkspaceRequest): Error | undefined {
    if (!request || !request.name) {
      return new Error("name is required");
    }
    return undefined;
  }
}
