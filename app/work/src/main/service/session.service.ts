import { Injectable } from "@willow/poetry";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";

@Injectable()
export class SessionService {
  async getSessionList(workspaceId: string) {
    // 获取 session 列表
  }

  async createSession(workspaceId: string) {
    // 创建 session
  }

  async deleteSession(sessionId: string) {
    // 删除 session
  }

  async getSessionHistory(sessionId: string) {
    // 获取 session 历史
  }

  sendSession(sessionId: string, data: any): void {
    // 发送 session
  }

  private createAgentSession(sessionId: string) {
    return new Agent({
      sessionId: sessionId,
      initialState: {
        model: getModel("anthropic", "claude-sonnet-4-20250514"),
      },
    });
  }
}
