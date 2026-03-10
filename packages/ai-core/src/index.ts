import { Container, interfaces } from "inversify";
import {
  ISession,
  ISessionManager,
  IDatabase,
  ISessionConfig,
  ISessionFactory,
} from "./interfaces";
import { TYPES } from "./types";
import { SessionImpl } from "./impl/session.impl"; // 只有这里需要 import 具体的类
import { SessionManagerImpl } from "./impl/session-manager.impl";
import { SQLiteImpl } from "./sqlite";

const container = new Container();

container.bind<IDatabase>(TYPES.IDatabase).to(SQLiteImpl);
container.bind<ISession>(TYPES.ISession).to(SessionImpl).inTransientScope();
container
  .bind<ISessionFactory>(ISessionFactory)
  .toFactory<ISession, [ISessionConfig]>((context: interfaces.Context) => {
    return (params: ISessionConfig) => {
      const session = context.container.get<ISession>(TYPES.ISession);
      session.init(params);
      return session;
    };
  });

// 4. 绑定 Manager
container.bind<ISessionManager>(TYPES.ISessionManager).to(SessionManagerImpl);

const manager = container.get<ISessionManager>(TYPES.ISessionManager);

export { manager };
