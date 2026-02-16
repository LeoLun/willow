/**
 * OpenCode API 层
 *
 * 封装 @opencode-ai/sdk/v2 客户端的所有接口调用，
 * 按领域分组，供 Vue 组件和 composables 使用。
 *
 * 所有方法自动获取单例客户端，无需手动管理连接。
 */

import { getClient } from "./client";
import type {
  Session,
  Message,
  Part,
  Event,
  Config,
  PermissionRuleset,
  TextPartInput,
  FilePartInput,
  AgentPartInput,
  SubtaskPartInput,
  McpLocalConfig,
  McpRemoteConfig,
} from "@opencode-ai/sdk/v2/client";

// ============================================================
// Re-export SDK types for convenience
// ============================================================

export type {
  Session,
  Message,
  UserMessage,
  AssistantMessage,
  Part,
  TextPart,
  ToolPart,
  ReasoningPart,
  FilePart,
  StepStartPart,
  StepFinishPart,
  SnapshotPart,
  PatchPart,
  AgentPart,
  SubtaskPart,
  CompactionPart,
  RetryPart,
  ToolState,
  ToolStatePending,
  ToolStateRunning,
  ToolStateCompleted,
  ToolStateError,
  Event,
  Config,
  Provider,
  Model,
  PermissionRequest,
  PermissionRuleset,
  PermissionRule,
  SessionStatus,
  QuestionRequest,
  QuestionAnswer,
  TextPartInput,
  FilePartInput,
  AgentPartInput,
  SubtaskPartInput,
  FileDiff,
  Todo,
  Agent,
  Command,
  Path,
  VcsInfo,
  McpLocalConfig,
  McpRemoteConfig,
  McpStatus,
  Project,
  FileNode,
  FileContent,
  // Global events
  EventMessageUpdated,
  EventMessageRemoved,
  EventMessagePartUpdated,
  EventMessagePartRemoved,
  EventPermissionAsked,
  EventPermissionReplied,
  EventSessionCreated,
  EventSessionUpdated,
  EventSessionDeleted,
  EventSessionStatus,
  EventSessionIdle,
  EventSessionDiff,
  EventSessionError,
  EventSessionCompacted,
  EventQuestionAsked,
  EventQuestionReplied,
  EventQuestionRejected,
  EventFileEdited,
  EventFileWatcherUpdated,
  EventTodoUpdated,
  EventVcsBranchUpdated,
  EventPtyCreated,
  EventPtyUpdated,
  EventPtyExited,
  EventPtyDeleted,
  EventMcpToolsChanged,
  EventCommandExecuted,
} from "@opencode-ai/sdk/v2/client";

// ============================================================
// Health + Global
// ============================================================

export const globalApi = {
  /** 健康检查 */
  async health() {
    const client = getClient();
    return client.global.health();
  },

  /** 销毁全局实例 */
  async dispose() {
    const client = getClient();
    return client.global.dispose();
  },
};

// ============================================================
// Sessions
// ============================================================

export const sessionApi = {
  /** 创建新会话 */
  async create(params?: {
    directory?: string;
    parentID?: string;
    title?: string;
    permission?: PermissionRuleset;
  }) {
    const client = getClient();
    return client.session.create(params);
  },

  /** 获取会话列表 */
  async list(params?: {
    directory?: string;
    roots?: boolean;
    start?: number;
    search?: string;
    limit?: number;
  }) {
    const client = getClient();
    return client.session.list(params);
  },

  /** 获取单个会话 */
  async get(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.get(params);
  },

  /** 获取会话状态 */
  async status(params?: { directory?: string }) {
    const client = getClient();
    return client.session.status(params);
  },

  /** 获取会话消息列表 */
  async messages(params: {
    sessionID: string;
    directory?: string;
    limit?: number;
  }) {
    const client = getClient();
    return client.session.messages(params);
  },

  /** 获取单条消息 */
  async message(params: {
    sessionID: string;
    messageID: string;
    directory?: string;
  }) {
    const client = getClient();
    return client.session.message(params);
  },

  /** 发送消息（同步，等待响应） */
  async prompt(params: {
    sessionID: string;
    directory?: string;
    messageID?: string;
    model?: { providerID: string; modelID: string };
    agent?: string;
    noReply?: boolean;
    system?: string;
    variant?: string;
    parts?: Array<
      TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput
    >;
  }) {
    const client = getClient();
    return client.session.prompt(params);
  },

  /** 发送消息（异步，立即返回） */
  async promptAsync(params: {
    sessionID: string;
    directory?: string;
    messageID?: string;
    model?: { providerID: string; modelID: string };
    agent?: string;
    parts?: Array<
      TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput
    >;
  }) {
    const client = getClient();
    return client.session.promptAsync(params);
  },

  /** 中止会话 */
  async abort(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.abort(params);
  },

  /** 摘要化会话 */
  async summarize(params: {
    sessionID: string;
    directory?: string;
    providerID?: string;
    modelID?: string;
    auto?: boolean;
  }) {
    const client = getClient();
    return client.session.summarize(params);
  },

  /** 删除会话 */
  async delete(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.delete(params);
  },

  /** 更新会话 */
  async update(params: {
    sessionID: string;
    directory?: string;
    title?: string;
    time?: { archived?: number };
  }) {
    const client = getClient();
    return client.session.update(params);
  },

  /** 获取会话子会话 */
  async children(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.children(params);
  },

  /** Fork 会话 */
  async fork(params: {
    sessionID: string;
    directory?: string;
    messageID?: string;
  }) {
    const client = getClient();
    return client.session.fork(params);
  },

  /** 获取会话 diff */
  async diff(params: {
    sessionID: string;
    directory?: string;
    messageID?: string;
  }) {
    const client = getClient();
    return client.session.diff(params);
  },

  /** 获取会话 todo 列表 */
  async todo(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.todo(params);
  },

  /** 初始化会话（生成 AGENTS.md） */
  async init(params: {
    sessionID: string;
    directory?: string;
    modelID?: string;
    providerID?: string;
    messageID?: string;
  }) {
    const client = getClient();
    return client.session.init(params);
  },

  /** 发送命令 */
  async command(params: {
    sessionID: string;
    directory?: string;
    command?: string;
    arguments?: string;
    agent?: string;
    model?: string;
  }) {
    const client = getClient();
    return client.session.command(params);
  },

  /** 执行 shell 命令 */
  async shell(params: {
    sessionID: string;
    directory?: string;
    agent?: string;
    model?: { providerID: string; modelID: string };
    command?: string;
  }) {
    const client = getClient();
    return client.session.shell(params);
  },

  /** 回退消息 */
  async revert(params: {
    sessionID: string;
    directory?: string;
    messageID?: string;
    partID?: string;
  }) {
    const client = getClient();
    return client.session.revert(params);
  },

  /** 恢复回退 */
  async unrevert(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.unrevert(params);
  },

  /** 分享会话 */
  async share(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.share(params);
  },

  /** 取消分享 */
  async unshare(params: { sessionID: string; directory?: string }) {
    const client = getClient();
    return client.session.unshare(params);
  },
};

// ============================================================
// Files + Search
// ============================================================

export const fileApi = {
  /** 读取文件内容 */
  async read(params: { path: string; directory?: string }) {
    const client = getClient();
    return client.file.read(params);
  },

  /** 列出文件 */
  async list(params: { path: string; directory?: string }) {
    const client = getClient();
    return client.file.list(params);
  },

  /** 获取文件 git 状态 */
  async status(params?: { directory?: string }) {
    const client = getClient();
    return client.file.status(params);
  },
};

export const findApi = {
  /** 全文搜索 */
  async text(params: { pattern: string; directory?: string }) {
    const client = getClient();
    return client.find.text(params);
  },

  /** 文件搜索 */
  async files(params: {
    query: string;
    directory?: string;
    type?: "file" | "directory";
    limit?: number;
  }) {
    const client = getClient();
    return client.find.files(params);
  },

  /** 符号搜索 */
  async symbols(params: { query: string; directory?: string }) {
    const client = getClient();
    return client.find.symbols(params);
  },
};

// ============================================================
// Permissions
// ============================================================

export const permissionApi = {
  /** 回复权限请求 */
  async reply(params: {
    requestID: string;
    directory?: string;
    reply?: "once" | "always" | "reject";
    message?: string;
  }) {
    const client = getClient();
    return client.permission.reply(params);
  },

  /** 列出待处理的权限请求 */
  async list(params?: { directory?: string }) {
    const client = getClient();
    return client.permission.list(params);
  },
};

// ============================================================
// Questions
// ============================================================

export const questionApi = {
  /** 列出待处理的问题 */
  async list(params?: { directory?: string }) {
    const client = getClient();
    return client.question.list(params);
  },

  /** 回复问题 */
  async reply(params: {
    requestID: string;
    directory?: string;
    answers?: Array<Array<string>>;
  }) {
    const client = getClient();
    return client.question.reply(params);
  },

  /** 拒绝问题 */
  async reject(params: { requestID: string; directory?: string }) {
    const client = getClient();
    return client.question.reject(params);
  },
};

// ============================================================
// Config + Providers
// ============================================================

export const configApi = {
  /** 获取项目配置 */
  async get(params?: { directory?: string }) {
    const client = getClient();
    return client.config.get(params);
  },

  /** 更新项目配置 */
  async update(params?: { directory?: string; config?: Config }) {
    const client = getClient();
    return client.config.update(params);
  },

  /** 获取 providers 列表 */
  async providers(params?: { directory?: string }) {
    const client = getClient();
    return client.config.providers(params);
  },
};

export const globalConfigApi = {
  /** 获取全局配置 */
  async get() {
    const client = getClient();
    return client.global.config.get();
  },

  /** 更新全局配置 */
  async update(params?: { config?: Config }) {
    const client = getClient();
    return client.global.config.update(params);
  },
};

// ============================================================
// Auth
// ============================================================

export const authApi = {
  /** 设置认证凭据 */
  async set(params: { providerID: string; auth?: any }) {
    const client = getClient();
    return client.auth.set(params);
  },

  /** 移除认证凭据 */
  async remove(params: { providerID: string }) {
    const client = getClient();
    return client.auth.remove(params);
  },
};

// ============================================================
// Provider
// ============================================================

export const providerApi = {
  /** 列出所有 providers */
  async list(params?: { directory?: string }) {
    const client = getClient();
    return client.provider.list(params);
  },

  /** 获取 provider 认证方法 */
  async auth(params?: { directory?: string }) {
    const client = getClient();
    return client.provider.auth(params);
  },

  /** OAuth 授权 */
  async oauthAuthorize(params: {
    providerID: string;
    directory?: string;
    method?: number;
  }) {
    const client = getClient();
    return client.provider.oauth.authorize(params);
  },

  /** OAuth 回调 */
  async oauthCallback(params: {
    providerID: string;
    directory?: string;
    method?: number;
    code?: string;
  }) {
    const client = getClient();
    return client.provider.oauth.callback(params);
  },
};

// ============================================================
// Projects + Path
// ============================================================

export const projectApi = {
  /** 列出项目 */
  async list(params?: { directory?: string }) {
    const client = getClient();
    return client.project.list(params);
  },

  /** 获取当前项目 */
  async current(params?: { directory?: string }) {
    const client = getClient();
    return client.project.current(params);
  },

  /** 更新项目 */
  async update(params: {
    projectID: string;
    directory?: string;
    name?: string;
    icon?: { url?: string; override?: string; color?: string };
    commands?: { start?: string };
  }) {
    const client = getClient();
    return client.project.update(params);
  },
};

export const pathApi = {
  /** 获取路径信息 */
  async get(params?: { directory?: string }) {
    const client = getClient();
    return client.path.get(params);
  },
};

// ============================================================
// VCS
// ============================================================

export const vcsApi = {
  /** 获取 VCS 信息 */
  async get(params?: { directory?: string }) {
    const client = getClient();
    return client.vcs.get(params);
  },
};

// ============================================================
// MCP
// ============================================================

export const mcpApi = {
  /** 获取 MCP 状态 */
  async status(params?: { directory?: string }) {
    const client = getClient();
    return client.mcp.status(params);
  },

  /** 添加 MCP 服务器 */
  async add(params?: {
    directory?: string;
    name?: string;
    config?: McpLocalConfig | McpRemoteConfig;
  }) {
    const client = getClient();
    return client.mcp.add(params);
  },

  /** 连接 MCP 服务器 */
  async connect(params: { name: string; directory?: string }) {
    const client = getClient();
    return client.mcp.connect(params);
  },

  /** 断开 MCP 服务器 */
  async disconnect(params: { name: string; directory?: string }) {
    const client = getClient();
    return client.mcp.disconnect(params);
  },

  /** 开始 MCP OAuth 认证 */
  async authStart(params: { name: string; directory?: string }) {
    const client = getClient();
    return client.mcp.auth.start(params);
  },

  /** 完成 MCP OAuth 回调 */
  async authCallback(params: {
    name: string;
    directory?: string;
    code?: string;
  }) {
    const client = getClient();
    return client.mcp.auth.callback(params);
  },

  /** MCP OAuth 全自动认证 */
  async authAuthenticate(params: { name: string; directory?: string }) {
    const client = getClient();
    return client.mcp.auth.authenticate(params);
  },

  /** 移除 MCP OAuth */
  async authRemove(params: { name: string; directory?: string }) {
    const client = getClient();
    return client.mcp.auth.remove(params);
  },
};

// ============================================================
// App (Agents, Skills, Commands, Log)
// ============================================================

export const appApi = {
  /** 获取 agents 列表 */
  async agents(params?: { directory?: string }) {
    const client = getClient();
    return client.app.agents(params);
  },

  /** 获取 skills 列表 */
  async skills(params?: { directory?: string }) {
    const client = getClient();
    return client.app.skills(params);
  },

  /** 写入日志 */
  async log(params?: {
    directory?: string;
    service?: string;
    level?: "debug" | "info" | "error" | "warn";
    message?: string;
    extra?: Record<string, unknown>;
  }) {
    const client = getClient();
    return client.app.log(params);
  },
};

export const commandApi = {
  /** 获取可用命令列表 */
  async list(params?: { directory?: string }) {
    const client = getClient();
    return client.command.list(params);
  },
};

// ============================================================
// Instance
// ============================================================

export const instanceApi = {
  /** 销毁实例 */
  async dispose(params?: { directory?: string }) {
    const client = getClient();
    return client.instance.dispose(params);
  },
};

// ============================================================
// Tools
// ============================================================

export const toolApi = {
  /** 获取工具 ID 列表 */
  async ids(params?: { directory?: string }) {
    const client = getClient();
    return client.tool.ids(params);
  },

  /** 获取工具列表 */
  async list(params: { directory?: string; provider: string; model: string }) {
    const client = getClient();
    return client.tool.list(params);
  },
};

// ============================================================
// Part
// ============================================================

export const partApi = {
  /** 删除 part */
  async delete(params: {
    sessionID: string;
    messageID: string;
    partID: string;
    directory?: string;
  }) {
    const client = getClient();
    return client.part.delete(params);
  },

  /** 更新 part */
  async update(params: {
    sessionID: string;
    messageID: string;
    partID: string;
    directory?: string;
    part?: Part;
  }) {
    const client = getClient();
    return client.part.update(params);
  },
};

// ============================================================
// LSP + Formatter
// ============================================================

export const lspApi = {
  /** 获取 LSP 状态 */
  async status(params?: { directory?: string }) {
    const client = getClient();
    return client.lsp.status(params);
  },
};

export const formatterApi = {
  /** 获取 formatter 状态 */
  async status(params?: { directory?: string }) {
    const client = getClient();
    return client.formatter.status(params);
  },
};

// ============================================================
// Event (SSE)
// ============================================================

export const eventApi = {
  /** 订阅 SSE 事件流 */
  async subscribe(params?: { directory?: string }) {
    const client = getClient();
    return client.event.subscribe(params);
  },
};
