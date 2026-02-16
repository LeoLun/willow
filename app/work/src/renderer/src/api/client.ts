import { type OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { createClient } from "@renderer/src/lib/opencode";
import { useInitStore } from "@/stores/init";

let client: OpencodeClient | null = null;
let baseUrl: string | null = null;

/**
 * 获取 OpenCode 客户端实例（单例，使用默认目录）
 * 使用 init store 中已初始化好的 URL 和目录
 */
export function getClient(): OpencodeClient {
  if (client) return client;

  const initStore = useInitStore();
  if (!initStore.opencodeUrl) {
    throw new Error("OpenCode 服务尚未初始化，请先完成 init 流程");
  }

  baseUrl = initStore.opencodeUrl;
  client = createClient(baseUrl, initStore.baseStartPath);
  return client;
}

/**
 * 获取指定目录的 OpenCode 客户端实例
 * 用于在非默认目录下创建会话
 */
export function getClientForDirectory(directory: string): OpencodeClient {
  const initStore = useInitStore();
  if (!initStore.opencodeUrl) {
    throw new Error("OpenCode 服务尚未初始化，请先完成 init 流程");
  }
  return createClient(initStore.opencodeUrl, directory);
}

/**
 * 获取当前 baseUrl（需在初始化后调用）
 */
export function getBaseUrl(): string | null {
  return baseUrl;
}

/**
 * 重置客户端（用于重新连接或测试）
 */
export function resetClient(): void {
  client = null;
  baseUrl = null;
}
