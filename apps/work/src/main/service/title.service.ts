import type { AgentHarness } from "@earendil-works/pi-agent-core";
import { MESSAGE_EVENT } from "@shared/constants";
import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { WorkspaceDao } from "./dao/workspace.dao.server";
import { EventService } from "./event.service";
import { SessionService } from "./session.service";
import { UserConfigService } from "./user-config.service";

export type CreateTitleInput = {
  workspaceId: number;
  sessionId: string;
  content: string;
};

const TITLE_MAX_LENGTH = 50;
const TITLE_SYSTEM_PROMPT = `You generate conversation titles.

Given a user message, output one concise title that helps retrieve the conversation later.

Requirements:

* Output only the title, on a single line
* Maximum ${TITLE_MAX_LENGTH} characters
* The title must use the same language as the user input
* If the input is Chinese, output Chinese; if it is English, output English
* For mixed-language input, use the dominant language
* Focus on the main question, task, or intent
* Write naturally and grammatically
* Preserve exact technical terms, numbers, filenames, and HTTP codes
* For files, describe what the user wants to do with the file
* Remove unnecessary articles such as “the”, “this”, “my”, “a”, and “an”
* Do not mention tools, assume an unstated tech stack, answer the question, or explain the title
* Do not use words like “summarizing” or “generating”
* Always produce a meaningful title, even for minimal input
* For greetings or casual messages, summarize the tone or intent, such as “Greeting” or “Quick check-in”

Examples:
“debug 500 errors in production” → Debugging production 500 errors
“why is app.js failing” → app.js failure investigation
“如何连接 Postgres” → Postgres 连接方法
“修复 app.js 报错” → app.js 报错修复
“@src/auth.ts 添加刷新令牌” → 添加刷新令牌支持
“@App.tsx add dark mode toggle” → Dark mode toggle in App`;

@Injectable()
export class TitleService {
  private readonly pendingTitles = new Map<string, Promise<void>>();

  constructor(
    private readonly sessionService: SessionService,
    private readonly agentService: AgentService,
    private readonly eventService: EventService,
    private readonly workspaceDao: WorkspaceDao,
    private readonly userConfigService: UserConfigService,
  ) {}

  startTitleCreation(input: CreateTitleInput): void {
    const key = this.taskKey(input.workspaceId, input.sessionId);
    if (this.pendingTitles.has(key)) return;

    const pending = this.createTitle(input)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        if (this.pendingTitles.get(key) === pending) {
          this.pendingTitles.delete(key);
        }
      });
    this.pendingTitles.set(key, pending);
  }

  async createTitle(input: CreateTitleInput): Promise<string> {
    const content = this.validateContent(input.content);
    const workspace = this.workspaceDao.findById(input.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${input.workspaceId}`);
    }

    const session = this.sessionService.getSession(input.workspaceId, input.sessionId);
    if (session.title.trim() !== "") return session.title;

    const fallbackTitle = this.normalizeTitle(content);
    let title = fallbackTitle;
    const smallModelConfig = this.userConfigService.getConfig().smallModel;

    if (smallModelConfig) {
      let harness: AgentHarness | undefined;
      try {
        const model = this.agentService.getModel(
          smallModelConfig.providerId,
          smallModelConfig.modelId,
        );
        harness = await this.agentService.getSimpleAgent({
          cwd: workspace.path,
          model,
          workspaceId: input.workspaceId,
          sessionId: input.sessionId,
          source: "title",
          systemPrompt: TITLE_SYSTEM_PROMPT,
        });
        const response = await harness.prompt(content);
        const generated = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join(" ");
        title = this.normalizeTitle(generated) || fallbackTitle;
      } catch {
        title = fallbackTitle;
      } finally {
        await harness?.env.cleanup();
      }
    }

    const current = this.sessionService.getSession(input.workspaceId, input.sessionId);
    if (current.title.trim() !== "") return current.title;

    await this.sessionService.updateSessionTitle(input.workspaceId, input.sessionId, title);
    this.eventService.sendEvent(MESSAGE_EVENT, {
      type: "title_updated",
      sessionId: input.sessionId,
      title,
    });
    return title;
  }

  private validateContent(content: string): string {
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("Message content must be a non-empty string");
    }
    return content.trim();
  }

  private normalizeTitle(value: string): string {
    const normalized = value
      .replace(/[`*_#]+/g, "")
      .replace(/^(["'“‘])|(["'”’])$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return [...normalized].slice(0, TITLE_MAX_LENGTH).join("");
  }

  private taskKey(workspaceId: number, sessionId: string): string {
    return `${workspaceId}:${sessionId}`;
  }
}
