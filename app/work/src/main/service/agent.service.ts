import { Injectable } from "@willow/poetry";
import { Agent } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { Session } from "@shared/api";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";

const DEFAULT_MODELS = {
  "deepseek-chat": {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    reasoning: false,
    input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 64000,
    maxTokens: 8192,
  },
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    reasoning: true,
    input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 64000,
    maxTokens: 8192,
  },
};

const systemPrompt = "你是一个有用的 AI 助手。";

@Injectable()
export class AgentService {
  constructor(private readonly sessionMessageDao: SessionMessageDao) {}

  async getDefaultAgent(session: Session) {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    // @TODO 后续模型需要从 configService 中获取
    const resolvedModel = DEFAULT_MODELS["deepseek-reasoner"];

    const apiKey = DEEPSEEK_API_KEY;
    const agent = new Agent({
      streamFn: streamSimple,
      getApiKey: () => apiKey,
    });
    agent.setModel(resolvedModel);
    agent.setSystemPrompt(systemPrompt);

    const rows = this.sessionMessageDao.findBySessionId(session.id);
    const history = parseStoredSessionMessages(rows);
    if (history.length > 0) {
      agent.replaceMessages(history);
    }

    return agent;
  }
}
