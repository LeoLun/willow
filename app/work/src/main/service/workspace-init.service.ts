import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { AgentService } from "@main/service/agent.service";
import { SkillService } from "@main/service/skill.service";
import { WorkspaceAgentService } from "@main/service/workspace-agent.service";
import { WorkspaceService } from "@main/service/workspace.service";
import { parseFrontmatter } from "@willow/core";
import { Injectable } from "@willow/poetry";

type AgentsFrontmatter = Record<string, unknown> & {
  name?: string;
  description?: string;
};

@Injectable()
export class WorkspaceInitService {
  private static readonly MAX_GENERATION_ATTEMPTS = 2;

  constructor(
    private readonly agentService: AgentService,
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceAgentService: WorkspaceAgentService,
    private readonly skillService: SkillService,
  ) {}

  async runInit(workspaceId: number): Promise<{ content: string; created: boolean }> {
    console.log("[WorkspaceInitService] runInit start workspaceId=", workspaceId);
    const workspace = await this.workspaceService.getWorkspaceInfo(workspaceId);
    if (!workspace || workspace.kind !== "project") {
      console.error("[WorkspaceInitService] not a project workspace:", workspace?.kind);
      throw new Error("/init 只能在项目工作空间中使用");
    }
    console.log("[WorkspaceInitService] workspace name=", workspace.name, "path=", workspace.path);

    const settings = await this.workspaceService.getWorkspaceSettings(workspaceId);
    const existingContent = settings.soulContent.trim();
    console.log("[WorkspaceInitService] existingContent length=", existingContent.length);
    const existingAgent = await this.workspaceAgentService.readWorkspaceAgent(workspace);
    const skills = this.skillService.getAvailableSkills(workspaceId).skills;
    const fileIndex = await this.buildFileIndex(workspace.path);
    console.log(
      "[WorkspaceInitService] skills count=",
      skills.length,
      "fileIndex count=",
      fileIndex.length,
    );
    const workspaceIdentifier = this.toWorkspaceIdentifier(workspace.name, workspace.path);
    const legacyName = this.extractLegacySectionValue(existingContent, "名称");
    const legacyDescription = this.extractLegacySectionValue(existingContent, "描述");
    const agentName = existingAgent.agentName || legacyName || `${workspace.name} 工作空间 Agent`;
    const agentDescription =
      existingAgent.agentDescription ||
      legacyDescription ||
      `当任务明显属于 ${workspace.name} 工作空间的代码、文档、配置或流程范围时触发；触发后在该工作空间内分析、修改并验证结果。这是对话功能调用此工作空间的主要触发机制。`;
    const prompt = this.buildInitPrompt({
      workspaceName: workspace.name,
      workspacePath: workspace.path,
      workspaceIdentifier,
      agentName,
      agentDescription,
      existingContent,
      skills: skills.map(
        (skill) => `${skill.name}（${skill.scopeLabel}）：${skill.description} [${skill.filePath}]`,
      ),
      fileIndex,
    });
    console.log("[WorkspaceInitService] calling LLM, prompt length=", prompt.length);
    const content = await this.generateValidatedContent({
      prompt,
      workspaceName: workspace.name,
      agentName,
      agentDescription,
    });
    console.log("[WorkspaceInitService] LLM done, content length=", content.length);

    await this.workspaceService.updateWorkspaceSettings(workspaceId, workspace.path, content);
    console.log("[WorkspaceInitService] runInit done, created=", !existingContent);

    return {
      content,
      created: !existingContent,
    };
  }

  private async buildFileIndex(workspacePath: string): Promise<string[]> {
    const entries = await readdir(workspacePath, { withFileTypes: true });
    const preferredNames = new Set([
      "AGENTS.md",
      "DESIGN.md",
      "package.json",
      "pnpm-workspace.yaml",
      "components.json",
      "README.md",
      "docs",
      "app",
      "packages",
    ]);

    return entries
      .filter((entry) => preferredNames.has(entry.name))
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  }

  private toWorkspaceIdentifier(name: string, workspacePath: string): string {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || basename(join(workspacePath));
  }

  private buildInitPrompt(input: {
    workspaceName: string;
    workspacePath: string;
    workspaceIdentifier: string;
    agentName: string;
    agentDescription: string;
    existingContent: string;
    skills: string[];
    fileIndex: string[];
  }): string {
    const {
      workspaceName,
      workspacePath,
      workspaceIdentifier,
      agentName,
      agentDescription,
      existingContent,
      skills,
      fileIndex,
    } = input;

    const skillsBlock =
      skills.length > 0
        ? skills.map((skill) => `- ${skill}`).join("\n")
        : "- 当前未发现可用的工作空间或全局技能。";
    const fileIndexBlock =
      fileIndex.length > 0
        ? fileIndex.map((item) => `- \`${item}\``).join("\n")
        : "- 当前未扫描到可索引的关键文件。";

    return `
请分析这个项目工作空间，并直接输出最终的 AGENTS.md Markdown 内容。

目标：
1. 生成或改进一个给该工作空间内智能 Agent 使用的 AGENTS.md。
2. 保留并优化既有仓库约束，不要写成泛泛而谈的说明书。
3. 让该文件顶部 YAML frontmatter 的 \`name\` 与 \`description\` 能被对话侧读取，用于路由到这个工作空间 Agent。

硬性要求：
- 输出必须是 Markdown 正文，不要添加代码块围栏。
- 文件必须以 YAML frontmatter 开头，且必须严格包含：
  ---
  name: "${agentName}"
  description: >-
    ${agentDescription}
  ---
- 总长度控制在约 150 行，允许小幅浮动，但不要明显过长。
- 必须包含以下信息：
  - 工作空间名称
  - 工作空间作用
  - 工作空间拥有的技能
  - 必须文件索引
  - 正文可继续包含中文“名称”“描述”等章节辅助人类阅读，但机器调度必须以前置元数据为准
- frontmatter \`description\` 必须明确说明：
  - 何时触发
  - 触发效果
  - 这是对话功能调用该工作空间的主要触发机制
- 若已有 AGENTS.md，优先做结构化改进和重写，保留其中有效的仓库约束与协作规则，不要无脑覆盖成模板腔。

建议结构：
1. 标题与工作空间概览
2. 工作空间作用与适用任务
3. 技能与工具入口索引
4. 必须文件索引
5. 触发定义
6. 协作约束或补充说明

当前工作空间信息：
- 工作空间名称：${workspaceName}
- 工作空间标识符：${workspaceIdentifier}
- 工作空间根目录：${workspacePath}
- 建议 Agent 名称：${agentName}
- 建议 Agent 描述：${agentDescription}

工作空间技能：
${skillsBlock}

关键文件索引：
- \`AGENTS.md\`：工作空间 Agent 说明与触发语义。
${fileIndexBlock}

${existingContent ? `现有 AGENTS.md 内容如下，请在保留有效约束的前提下改进：\n\n${existingContent}` : "当前不存在 AGENTS.md，请基于以上信息创建首版内容。"}
`.trim();
  }

  private async generateValidatedContent(input: {
    prompt: string;
    workspaceName: string;
    agentName: string;
    agentDescription: string;
  }): Promise<string> {
    const { prompt, workspaceName, agentName, agentDescription } = input;
    let currentPrompt = prompt;
    let latestContent = "";
    let missingRequirements: string[] = [];

    for (let attempt = 1; attempt <= WorkspaceInitService.MAX_GENERATION_ATTEMPTS; attempt += 1) {
      latestContent = await this.agentService.generateSingleTurnText(currentPrompt);
      missingRequirements = this.getMissingRequirements(latestContent);
      if (missingRequirements.length === 0) {
        return latestContent;
      }

      currentPrompt = this.buildRepairPrompt({
        workspaceName,
        agentName,
        agentDescription,
        content: latestContent,
        missingRequirements,
      });
    }

    throw new Error(`生成的 AGENTS.md 仍缺少必要内容：${missingRequirements.join("、")}`);
  }

  private buildRepairPrompt(input: {
    workspaceName: string;
    agentName: string;
    agentDescription: string;
    content: string;
    missingRequirements: string[];
  }): string {
    const { workspaceName, agentName, agentDescription, content, missingRequirements } = input;

    return `
你刚刚输出了一版 ${workspaceName} 工作空间的 AGENTS.md，但它还不满足格式约束。

必须修复的问题：
${missingRequirements.map((item) => `- ${item}`).join("\n")}

修复要求：
- 直接输出修复后的完整 AGENTS.md Markdown 正文，不要解释。
- 必须保留已有有效仓库约束，不要缩成模板空壳。
- 文件必须以 YAML frontmatter 开头，且必须严格包含：
  ---
  name: "${agentName}"
  description: >-
    ${agentDescription}
  ---
- frontmatter \`description\` 必须明确说明何时触发、触发效果，以及这是对话功能调用该工作空间的主要触发机制。
- 正文可继续包含中文“名称”“描述”等章节辅助人类阅读，但机器调度必须以前置元数据为准。
- 必须保留“工作空间作用”和“必须文件索引”两个部分。

当前不合格输出如下，请直接基于它修复并重写完整内容：

${content}
`.trim();
  }

  private getMissingRequirements(content: string): string[] {
    const missingRequirements: string[] = [];
    let frontmatter: AgentsFrontmatter = {};

    try {
      frontmatter = parseFrontmatter<AgentsFrontmatter>(content).frontmatter;
    } catch {
      missingRequirements.push("frontmatter 必须是合法 YAML");
    }

    if (!content.replace(/\r\n/g, "\n").startsWith("---\n")) {
      missingRequirements.push("必须以 YAML frontmatter 开头");
    }

    if (!frontmatter.name?.trim()) {
      missingRequirements.push("frontmatter 字段：name");
    }

    if (!frontmatter.description?.trim()) {
      missingRequirements.push("frontmatter 字段：description");
    }

    const requiredPhrases = ["工作空间作用", "必须文件索引"];
    for (const phrase of requiredPhrases) {
      if (!content.includes(phrase)) {
        missingRequirements.push(`必填部分：${phrase}`);
      }
    }

    return missingRequirements;
  }

  private extractLegacySectionValue(content: string, label: string): string {
    const pattern = new RegExp(`^${label}\\s*[：:]\\s*(.+)$`, "m");
    const match = content.match(pattern);
    return match?.[1]?.trim() ?? "";
  }

  private validateGeneratedContent(content: string): void {
    const missingRequirements = this.getMissingRequirements(content);
    if (missingRequirements.length > 0) {
      throw new Error(`生成的 AGENTS.md 仍缺少必要内容：${missingRequirements.join("、")}`);
    }
  }
}
