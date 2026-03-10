import { Injectable } from "@willow/poetry";
import { createOpencodeServer } from "@opencode-ai/sdk/v2/server";

@Injectable()
export class OpencodeService {
  private server: Awaited<ReturnType<typeof createOpencodeServer>>;

  async start() {
    if (this.server) {
      return { success: true, url: this.server.url };
    }

    // 使用 port: 0 让 OS 分配可用端口，避免端口冲突
    this.server = await createOpencodeServer({
      port: 0,
    });

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
