import {
  JsonlSessionRepo,
  JsonlSessionMetadata,
  JsonlSessionCreateOptions,
  JsonlSessionListOptions,
} from "@earendil-works/pi-agent-core";
import type { SessionManagerOption } from "./types";

export class SessionManager {
  private repo: JsonlSessionRepo;
  constructor(options: SessionManagerOption) {
    this.repo = new JsonlSessionRepo({
      fs: options.env,
      sessionsRoot: options.sessionsRoot,
    });
  }

  list(options?: JsonlSessionListOptions) {
    return this.repo.list(options);
  }
  create(options: JsonlSessionCreateOptions) {
    return this.repo.create(options);
  }
  open(metadata: JsonlSessionMetadata) {
    return this.repo.open(metadata);
  }
  delete(metadata: JsonlSessionMetadata) {
    return this.repo.delete(metadata);
  }
}
