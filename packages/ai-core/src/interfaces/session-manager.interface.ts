import { ISession } from "./session.interface";
import { IDatabase } from "./db.interface";

export interface ISessionManager {
  sessions: ISession[];
  db: IDatabase;

  // 创建会话
  createSession(): ISession;
  // 删除会话
  deleteSession(sessionId: string): void;
  // 获取会话
  getSession(sessionId: string): ISession;
  // 获取会话列表
  getSessionList(): ISession[];
}
