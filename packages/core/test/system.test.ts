import { arch, platform, release, type } from "node:os";
import type { Skill } from "@earendil-works/pi-agent-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemPrompt } from "../src/prompt/system";
import type { SystemPromptOptions } from "../src/types";

function createOptions(overrides: Partial<SystemPromptOptions> = {}): SystemPromptOptions {
  return {
    cwd: "/workspace/project",
    agentDir: "/users/test/.willow",
    skills: [],
    agentsFiles: [],
    roleAdditional: "",
    ...overrides,
  };
}

describe("getSystemPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T08:00:00.000Z"));
    vi.stubEnv("SHELL", "/bin/test-shell");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("renders project instructions in discovery order with escaped paths", () => {
    const prompt = getSystemPrompt(
      createOptions({
        agentsFiles: [
          {
            path: "/workspace/project/AGENTS.md",
            content: "Root instruction with <rule>.",
          },
          {
            path: '/workspace/project/packages/agent-"core"/CLAUDE.md',
            content: "Nested instruction.",
          },
        ],
      }),
    );

    expect(prompt).toContain("<project_context>");
    expect(prompt).toContain(
      '<project_instructions path="/workspace/project/AGENTS.md">\nRoot instruction with <rule>.\n</project_instructions>',
    );
    expect(prompt).toContain(
      '<project_instructions path="/workspace/project/packages/agent-&quot;core&quot;/CLAUDE.md">\nNested instruction.\n</project_instructions>',
    );
    expect(prompt.indexOf("Root instruction")).toBeLessThan(prompt.indexOf("Nested instruction"));
  });

  it("renders escaped skill metadata with capability-neutral guidance", () => {
    const skill: Skill = {
      name: "review & verify",
      description: 'Use <carefully> "now".',
      content: "Full instructions.",
      filePath: "/skills/review's/SKILL.md",
    };

    const prompt = getSystemPrompt(createOptions({ skills: [skill] }));

    expect(prompt).toContain(
      "Use an available file-reading tool to load a skill's file when the task matches its description.",
    );
    expect(prompt).toContain("<name>review &amp; verify</name>");
    expect(prompt).toContain("<description>Use &lt;carefully&gt; &quot;now&quot;.</description>");
    expect(prompt).toContain("<location>/skills/review&apos;s/SKILL.md</location>");
  });

  it("renders the complete English behavioral contract and environment", () => {
    const prompt = getSystemPrompt(createOptions());

    expect(prompt).toContain(
      "You are Willow Code, an interactive coding agent running on the user's computer.",
    );
    expect(prompt).toContain("# Language");
    expect(prompt).toContain("Write in the language used by the user's most recent request");
    expect(prompt).toContain("# Prompt and Tool Use");
    expect(prompt).toContain("# Built-in Tools");
    expect(prompt).toContain("`find` locates files by glob pattern");
    expect(prompt).toContain("`grep` searches text with a regular expression by default");
    expect(prompt).toContain(
      "`edit` changes an existing file using one or more exact replacements",
    );
    expect(prompt).toContain("An approval applies to the current tool call only");
    expect(prompt).toContain("# General Guidelines for Coding");
    expect(prompt).toContain("# General Guidelines for Research and Data Processing");
    expect(prompt).toContain("# Context Management");
    expect(prompt).toContain("# Working Environment");
    expect(prompt).toContain("Current date: 2026-07-10");
    expect(prompt).toContain("Current working directory: /workspace/project");
    expect(prompt).toContain("Project skills directory: /workspace/project/.agents/skills");
    expect(prompt).toContain("Global skills directory: /users/test/.willow/skills");
    expect(prompt).toContain(
      "create a named child directory under the project skills directory by default",
    );
    expect(prompt).toContain(`Operating system: ${type()}`);
    expect(prompt).toContain(`Platform: ${platform()}`);
    expect(prompt).toContain(`OS release: ${release()}`);
    expect(prompt).toContain(`Architecture: ${arch()}`);
    expect(prompt).toContain("Shell: /bin/test-shell");
    expect(prompt).toContain("# Ultimate Reminders");
    expect(prompt).not.toMatch(/`(?:Read|Glob|Grep|WriteFile|Shell|Agent|TaskList)`/);
    expect(prompt).not.toMatch(/\{[{%]|[}%]\}/);
    expect(prompt).not.toContain("预留");
    expect(prompt).not.toContain("技能提示词");
  });

  it("omits optional sections when their inputs are empty", () => {
    const prompt = getSystemPrompt(createOptions());

    expect(prompt).not.toContain("# Additional Role");
    expect(prompt).not.toContain("# Project Information");
    expect(prompt).not.toContain("<project_context>");
    expect(prompt).not.toContain("# Skills");
    expect(prompt).not.toContain("<available_skills>");
    expect(prompt).not.toContain("# 项目 AGENTS.md");
    expect(prompt).not.toContain("# SKILLS");
  });

  it("renders optional sections only when supplied", () => {
    const prompt = getSystemPrompt(
      createOptions({
        roleAdditional: "You specialize in TypeScript migration work.",
        agentsFiles: [
          {
            path: "/workspace/project/AGENTS.md",
            content: "Use pnpm for all package commands.",
          },
        ],
        skills: [
          {
            name: "review",
            description: "Review changes before completion.",
            content: "Review instructions.",
            filePath: "/skills/review/SKILL.md",
          },
        ],
      }),
    );

    expect(prompt).toContain("# Additional Role");
    expect(prompt).toContain("You specialize in TypeScript migration work.");
    expect(prompt).toContain("# Project Information");
    expect(prompt).toContain("Use pnpm for all package commands.");
    expect(prompt).toContain("# Skills");
    expect(prompt).toContain("<name>review</name>");
  });
});
