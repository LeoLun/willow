import { Injectable, IPC } from "@willow/poetry";

@Injectable()
export class WorkspaceController {
  @IPC("GET_WORKSPACE_LIST")
  async getWorkspaceList(_event: Electron.IpcMainInvokeEvent): Promise<any> {
    // 获取 workspace 列表
  }
  @IPC("CREATE_WORKSPACE")
  async createWorkspace(_event: Electron.IpcMainInvokeEvent): Promise<any> {
    // 创建 workspace
  }
  @IPC("DELETE_WORKSPACE")
  async deleteWorkspace(
    _event: Electron.IpcMainInvokeEvent,
    workspaceId: string,
  ): Promise<any> {
    // 删除 workspace
  }
  @IPC("GET_WORKSPACE_INFO")
  async getWorkspaceInfo(
    _event: Electron.IpcMainInvokeEvent,
    workspaceId: string,
  ): Promise<any> {
    // 获取 workspace 信息
  }
}
