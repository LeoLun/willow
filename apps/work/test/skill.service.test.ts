import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  coreOptions: [] as unknown[],
  skills: [
    {
      name: "review",
      description: "Review changes",
      filePath: "/app/resources/skills/review/SKILL.md",
    },
    {
      name: "personal",
      description: "Personal skill",
      filePath: "/users/test/.willow/skills/personal/SKILL.md",
    },
    {
      name: "workspace",
      description: "Workspace skill",
      filePath: "/workspace/.agents/skills/workspace/SKILL.md",
    },
  ],
}));

vi.mock("@willow/core", () => ({
  AgentCore: class AgentCore {
    constructor(options: unknown) {
      mocks.coreOptions.push(options);
    }

    async getSkills() {
      return mocks.skills;
    }
  },
}));

import type { AgentService } from "../src/main/service/agent.service";
import type { BuiltinSkillService } from "../src/main/service/builtin-skill.service";
import type { SessionManagerFactory } from "../src/main/service/session-manager.factory";
import { SkillService } from "../src/main/service/skill.service";
import type { WorkspaceService } from "../src/main/service/workspace.service";

describe("SkillService", () => {
  const agentService = {
    getModels: vi.fn(() => ({})),
  } as unknown as AgentService;
  const sessionManagerFactory = {
    create: vi.fn(() => ({})),
  } as unknown as SessionManagerFactory;
  const workspaceService = {
    getWorkspaceDetail: vi.fn(() => ({ path: "/workspace" })),
  } as unknown as WorkspaceService;
  const builtinSkillService = {
    getCoreOptions: vi.fn(() => ({
      directory: "/app/resources/skills",
      disabledIds: ["disabled-skill"],
    })),
  } as unknown as BuiltinSkillService;
  const service = new SkillService(
    agentService,
    sessionManagerFactory,
    workspaceService,
    builtinSkillService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.coreOptions.length = 0;
  });

  it("passes current built-in skill settings to Core and maps active skills", async () => {
    await expect(service.getSkillList(7)).resolves.toEqual([
      { ...mocks.skills[0], source: "builtin" },
      { ...mocks.skills[1], source: "global" },
      { ...mocks.skills[2], source: "project" },
    ]);
    expect(mocks.coreOptions[0]).toMatchObject({
      cwd: "/workspace",
      builtinSkills: {
        directory: "/app/resources/skills",
        disabledIds: ["disabled-skill"],
      },
    });
  });
});
