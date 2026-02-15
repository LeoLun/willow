import { Injectable } from "poetry";
import { createOpencodeServer } from "@opencode-ai/sdk/v2/server";
@Injectable()
export class OpencodeService {
  private server: Awaited<ReturnType<typeof createOpencodeServer>>;

  async start() {
    if (this.server) {
      return { success: true, url: this.server.url };
    }
    // process.env.OPENCODE_CLIENT = "willow-cli";
    // process.env.OPENWORK = "1";
    // process.env.OPENCODE_SERVER_USERNAME = "willow-work";
    // process.env.OPENCODE_SERVER_PASSWORD = "token123456";
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
