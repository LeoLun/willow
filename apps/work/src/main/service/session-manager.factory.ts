import { Injectable } from "@willow/poetry";
import { SessionManager } from "../utils/session-manager";
import { SessionDao } from "./dao/session.dao.server";

@Injectable()
export class SessionManagerFactory {
  constructor(private readonly sessionDao: SessionDao) {}

  create(workspaceId: number): SessionManager {
    return new SessionManager(this.sessionDao, workspaceId);
  }
}
