import type { ApiResponse, ReadPlanFileRequest, ReadPlanFileResponse } from "@shared/api";
import { READ_PLAN_FILE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import {
  InvalidPlanFilePathError,
  PlanFileNotFoundError,
  PlanFileService,
} from "../../service/plan-file.service";
import { IPCBaseController } from "../ipc.base.controller";

const MAX_PATH_LENGTH = 4_096;

@Injectable()
export class ReadPlanFileController extends IPCBaseController<
  ReadPlanFileRequest,
  ReadPlanFileResponse
> {
  constructor(private readonly planFileService: PlanFileService) {
    super();
  }

  @IPC(READ_PLAN_FILE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ReadPlanFileRequest,
  ): Promise<ApiResponse<ReadPlanFileResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      return this.buildResponse({ file: await this.planFileService.readPlanFile(request.path) });
    } catch (error) {
      if (error instanceof PlanFileNotFoundError) {
        return this.buildError(404, error.message);
      }
      if (error instanceof InvalidPlanFilePathError) {
        return this.buildError(400, error.message);
      }
      throw error;
    }
  }

  checkParams(request: ReadPlanFileRequest): Error | undefined {
    if (!request || typeof request.path !== "string" || request.path.trim() === "") {
      return new Error("path must be a non-empty string");
    }
    if (request.path.length > MAX_PATH_LENGTH) {
      return new Error(`path must not exceed ${MAX_PATH_LENGTH} characters`);
    }
    return undefined;
  }
}
