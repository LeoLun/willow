import { Injectable } from "poetry";
import { createOpencodeServer } from "@opencode-ai/sdk/v2/server";
@Injectable()
export class OpencodeService {
  private server: Awaited<ReturnType<typeof createOpencodeServer>>;

  async start() {
    if (this.server) {
      return { success: true, url: this.server.url };
    }
    this.server = await createOpencodeServer();
    return { success: true, url: this.server.url };
  }

  async stop() {
    if (!this.server) {
      return { success: true, message: "Server not started" };
    }
    await this.server.close();
    this.server = null;
    return { success: true, message: "Server stopped" };
  }

  getServerUrl() {
    return this.server.url;
  }
}
