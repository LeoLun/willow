import { MessageService } from "@main/service/message.service";
import type {
  ApiResponse,
  ResolveUserQuestionRequest,
  ResolveUserQuestionResponse,
} from "@shared/api";
import { RESOLVE_USER_QUESTION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ResolveUserQuestionController extends IPCBaseController<
  ResolveUserQuestionRequest,
  ResolveUserQuestionResponse
> {
  constructor(private readonly messageService: MessageService) {
    super();
  }

  @IPC(RESOLVE_USER_QUESTION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ResolveUserQuestionRequest,
  ): Promise<ApiResponse<ResolveUserQuestionResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse({ resolved: await this.messageService.resolveUserQuestion(request) });
  }

  checkParams(request: ResolveUserQuestionRequest): Error | undefined {
    if (!request || typeof request.requestId !== "string" || request.requestId.trim() === "") {
      return new Error("requestId must be a non-empty string");
    }
    if (!Number.isInteger(request.workspaceId) || request.workspaceId <= 0) {
      return new Error("workspaceId must be a positive integer");
    }
    if (typeof request.sessionId !== "string" || request.sessionId.trim() === "") {
      return new Error("sessionId must be a non-empty string");
    }
    if (request.answers !== undefined) {
      if (typeof request.answers !== "object" || request.answers === null) {
        return new Error("answers must be an object");
      }
      for (const [question, answers] of Object.entries(request.answers)) {
        if (question.trim() === "" || !Array.isArray(answers)) {
          return new Error("answers must map question text to an array");
        }
        if (answers.some((answer) => typeof answer !== "string" || answer.trim() === "")) {
          return new Error("answer values must be non-empty strings");
        }
      }
    }
    return undefined;
  }
}
