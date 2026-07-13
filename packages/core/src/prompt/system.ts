import type { Skill } from "@earendil-works/pi-agent-core";
import type { AgentsFile, SystemPromptOptions } from "../types";
import { renderPrompt } from "../utils/render-prompt";
import systemPrompt from "./system.md?raw";

function buildEnvPrompt(cwd: string): string {
  let prompt = `Current date: ${new Date().toISOString().split("T")[0]}`;
  prompt += `\nCurrent working directory: ${cwd}`;
  return prompt;
}

function buildSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return "";
  }

  const lines = [
    "The following skills provide specialized instructions for specific tasks.",
    "Use an available file-reading tool to load a skill's file when the task matches its description.",
    "Read the complete skill instructions before acting on them.",
    "When a skill file references a relative path, resolve it against the skill directory (the parent of SKILL.md) and use that resolved path in tool calls.",
    "",
    "<available_skills>",
  ];

  for (const skill of skills) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(
      `    <description>${escapeXml(skill.description)}</description>`,
    );
    lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
    lines.push("  </skill>");
  }

  lines.push("</available_skills>");

  return lines.join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildAgentsPrompt(agentsFiles: AgentsFile[]): string {
  if (agentsFiles.length === 0) {
    return "";
  }

  const lines = ["<project_context>"];

  for (const file of agentsFiles) {
    lines.push(`<project_instructions path="${escapeXml(file.path)}">`);
    lines.push(file.content);
    lines.push("</project_instructions>");
  }

  lines.push("</project_context>");
  return lines.join("\n");
}

export function getSystemPrompt(options: SystemPromptOptions): string {
  const envPrompt = buildEnvPrompt(options.cwd);
  return renderPrompt(systemPrompt, {
    WILLOW_ENV: envPrompt,
    WILLOW_SKILLS: buildSkillsPrompt(options.skills),
    WILLOW_AGENTS_MD: buildAgentsPrompt(options.agentsFiles),
    ROLE_ADDITIONAL: options.roleAdditional,
  });
}
