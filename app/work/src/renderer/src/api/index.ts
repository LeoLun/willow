/**
 * API 层统一入口
 *
 * @example
 * ```ts
 * import {
 *   sessionApi,
 *   fileApi,
 *   permissionApi,
 *   configApi,
 *   eventApi,
 * } from "@/api";
 *
 * // 创建会话
 * const session = await sessionApi.create({ title: "My Task" });
 *
 * // 发送消息
 * await sessionApi.prompt({
 *   sessionID: session.data.id,
 *   parts: [{ type: "text", text: "Hello!" }],
 * });
 * ```
 */

export { getClient, getBaseUrl, resetClient } from "./client";

export {
  globalApi,
  sessionApi,
  fileApi,
  findApi,
  permissionApi,
  questionApi,
  configApi,
  globalConfigApi,
  authApi,
  providerApi,
  projectApi,
  pathApi,
  vcsApi,
  mcpApi,
  appApi,
  commandApi,
  instanceApi,
  toolApi,
  partApi,
  lspApi,
  formatterApi,
  eventApi,
} from "./opencode";

// Re-export all types
export type * from "./opencode";
