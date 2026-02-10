import { electronAPI } from "@renderer/src/lib/ipc";
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";

let baseUrl: string;

class OpencodeService {
  async init() {
    if (baseUrl) {
      return baseUrl;
    }
    const { url } = await electronAPI.startOpencode();
    baseUrl = url;
    return baseUrl;
  }

  async createClient({ directory }: { directory: string }) {
    const baseUrl = await this.init();
    return createOpencodeClient({
      baseUrl,
      directory,
    });
  }
}

export default OpencodeService;
