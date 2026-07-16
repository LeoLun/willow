import { Injectable } from "@willow/poetry";

/**
 * 用于管理 Session 的服务
 */
@Injectable()
export class SessionService {
  // 获取 Session 列表
  getSessionList(projectId: string) {
    // 根据项目 ID 获取 Session 列表
    console.log("projectId", projectId);
  }

  // 创建 Session
  createSession() {}

  // 删除 Session
  deleteSession() {}

  // 修改 Session 标题
  updateSessionTitle() {}
}
