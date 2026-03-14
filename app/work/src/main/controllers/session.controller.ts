import { Injectable, IPC } from "@willow/poetry";
import { SessionService } from "@main/service/session.service";

@Injectable()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @IPC("GET_SESSION_LIST")
  async getSessionList(
    _event: Electron.IpcMainInvokeEvent,
    workspaceId: string,
  ): Promise<any> {
    return this.sessionService.getSessionList(workspaceId);
  }
  @IPC("CREATE_SESSION")
  async createSession(
    _event: Electron.IpcMainInvokeEvent,
    workspaceId: string,
  ): Promise<any> {
    return this.sessionService.createSession(workspaceId);
  }
  @IPC("DELETE_SESSION")
  async deleteSession(
    _event: Electron.IpcMainInvokeEvent,
    sessionId: string,
  ): Promise<any> {
    return this.sessionService.deleteSession(sessionId);
  }
  @IPC("GET_SESSION_HISTORY")
  async getSessionHistory(
    _event: Electron.IpcMainInvokeEvent,
    sessionId: string,
  ): Promise<any> {
    return this.sessionService.getSessionHistory(sessionId);
  }

  @IPC("SEND_SESSION")
  sendSession(
    _event: Electron.IpcMainInvokeEvent,
    sessionId: string,
    data: any,
  ): void {
    return this.sessionService.sendSession(sessionId, data);
  }
}
