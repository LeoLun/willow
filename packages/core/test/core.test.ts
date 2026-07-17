import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemorySessionRepo } from "@earendil-works/pi-agent-core";
import type { CredentialStore } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentCore } from "../src/core.js";

describe("AgentCore model setup", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
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
});
