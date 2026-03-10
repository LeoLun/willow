import type {
  ISessionManager,
  ISession,
  IDatabase,
  ISessionFactory,
} from "../interfaces";

export class SessionManagerImpl implements ISessionManager {
  sessions: ISession[] = [];
  db: IDatabase;
  sessionFactory: ISessionFactory;

  constructor(sessionFactory: ISessionFactory, db: IDatabase) {
    this.db = db;
    this.sessionFactory = sessionFactory;
  }

  createSession(): ISession {
    const session = this.sessionFactory({
      id: "",
      title: "新会话",
      systemPrompt: "",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 写入数据库
    return session;
  }
  deleteSession(sessionId: string): void {
    throw new Error("Method not implemented.");
  }
  getSession(sessionId: string): ISession {
    throw new Error("Method not implemented.");
  }
  getSessionList(): ISession[] {
    throw new Error("Method not implemented.");
  }
}
