import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemorySessionRepo } from "@earendil-works/pi-agent-core";
import type { CredentialStore } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentCore } from "../src/core.js";
import type { ToolRuntimeOptions } from "../src/tools/types.js";

const capturedToolOptions = vi.hoisted(() => [] as ToolRuntimeOptions[]);

vi.mock("../src/tools/index.js", () => ({
  createWillowTools: vi.fn((options: ToolRuntimeOptions) => {
    capturedToolOptions.push(options);
    return [];
  }),
}));

describe("AgentCore model setup", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    capturedToolOptions.length = 0;
    await Promise.all(
      temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it("resolves the configured DeepSeek model", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-core-"));
    temporaryDirectories.push(cwd);
    const credentials = {
      read: vi.fn(async () => ({ type: "api_key" as const, key: "sk-test" })),
      modify: vi.fn(async (_providerId, update) => update({ type: "api_key", key: "sk-test" })),
      delete: vi.fn(async () => undefined),
    } satisfies CredentialStore;
    const core = new AgentCore({
      cwd,
      models: builtinModels({ credentials }),
      sessionRepo: new InMemorySessionRepo(),
    });

    expect(core.getModel("deepseek", "deepseek-v4-flash").id).toBe("deepseek-v4-flash");
  });

  it("allows read and write access to the built-in skills directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-core-"));
    const builtinSkillsDirectory = await mkdtemp(join(tmpdir(), "willow-builtin-skills-"));
    temporaryDirectories.push(cwd, builtinSkillsDirectory);
    const credentials = {
      read: vi.fn(async () => ({ type: "api_key" as const, key: "sk-test" })),
      modify: vi.fn(async (_providerId, update) => update({ type: "api_key", key: "sk-test" })),
      delete: vi.fn(async () => undefined),
    } satisfies CredentialStore;
    const models = builtinModels({ credentials });
    const core = new AgentCore({
      cwd,
      models,
      sessionRepo: new InMemorySessionRepo(),
      builtinSkills: { directory: builtinSkillsDirectory },
    });

    await core.getAgentHarness({
      model: models.getModel("deepseek", "deepseek-v4-flash")!,
      permissionMode: "full-access",
      sandboxPolicy: {
        allowRead: ["/existing-read"],
        allowWrite: ["/existing-write"],
      },
    });

    expect(capturedToolOptions).toHaveLength(1);
    expect(capturedToolOptions[0].sandboxPolicy).toEqual({
      allowRead: ["/existing-read", builtinSkillsDirectory],
      allowWrite: ["/existing-write", builtinSkillsDirectory],
    });
  });
});
