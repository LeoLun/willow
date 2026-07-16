import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { EventService } from "./event.service";
import { SessionService } from "./session.service";

/**
 * 用于管理 Message 的服务
 */
@Injectable()
export class MessageService {
  // 缓存最近一次 AgentHarness

  constructor(
    private readonly sessionService: SessionService,
    private readonly agentService: AgentService,
    private readonly eventService: EventService,
  ) {}

  // 发送消息
  sendMessage() {
    // 获取 session
    // 获取历史消息
    // 构建AgentHarness
    // 发送消息
    // 检查是否有标题，如果没有则将用户消息
    // 流式推送消息
  }

  // 恢复消息
  resumeMessage() {}

  // 停止消息
  stopMessage() {}

  // 获取消息列表
  getMessageList() {}

  // 创建会话标题
  createTitle() {
    // 创建轻量级 Agent
    // 将用户消息传递给 Agent
    // 获取 Agent 的回答
    // 更新 Session 标题
    // this.sessionService.updateSessionTitle(sessionId, title);
  }
}
